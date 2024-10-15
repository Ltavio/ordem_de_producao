const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const { Pool } = require('pg');
const PDFDocument = require('pdfkit');
const pdfToPrinter = require('pdf-to-printer');
const cron = require('cron');

const app = express();
const port = 3000;

let config = { ultimoVendaId: 0 };
if (fs.existsSync('config.json')) {
    const data = fs.readFileSync('config.json', 'utf8');
    config = JSON.parse(data);
}
let ultimoVendaId = config.ultimoVendaId;

// Configuração do banco de dados
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'linxpostospos',
  password: 'postgres',
  port: 5470
});

// Configuração do cron job
const cronJob = new cron.CronJob('*/5 * * * * *', async () => {
  console.log('Executando verificação e impressão de vendas...');
  await processarVendas();
});
cronJob.start()

// Middleware para análise de JSON
app.use(bodyParser.json());


async function processarVendas() {
    try {
        
    

        const novasVendas = await pool.query(
            `SELECT id, venda_id, nr_item, produto_nome, situacao, produto_composicao, produto_complemento, produto_preparo
            FROM movto.venda_produto 
            WHERE situacao = 1 AND venda_id > $1`, [ultimoVendaId]
          );

          console.log(novasVendas);
          
          if (novasVendas.rows.length > 0) {
            let vendasAgrupadas = [];
            let ignoreFutureIds = false;

            for (const venda of novasVendas.rows) {
                if (ignoreFutureIds) {
                    console.log(`Ignorando venda_id ${venda.venda_id} pois um venda_id anterior não foi encontrado na tabela movto.nota_fiscal.`);
                    continue;
                }

                const resultado = await pool.query('SELECT * FROM movto.nota_fiscal WHERE venda_id = $1', [venda.venda_id]);

                if (resultado.rows.length > 0) {
                    console.log(`O venda_id ${venda.venda_id} já está na tabela movto.nota_fiscal.`);
                    vendasAgrupadas.push(venda);
                } else {
                    console.log(`O venda_id ${venda.venda_id} ainda não está na tabela movto.nota_fiscal. Ignorando futuras vendas até encontrar uma válida.`);
                    ignoreFutureIds = true;
                }
            }
    
            if (vendasAgrupadas.length > 0) {
              await imprimirPDFVenda(vendasAgrupadas);
    
              // Atualiza o último venda_id processado
              ultimoVendaId = vendasAgrupadas[vendasAgrupadas.length - 1].venda_id;
              config.ultimoVendaId = ultimoVendaId;
              fs.writeFileSync('config.json', JSON.stringify(config));
            }
          }  else {
        console.log('Nenhuma nova venda encontrada.');
      }
    } catch (error) {
      console.error('Erro ao processar vendas:', error);
    }
  }

  async function imprimirPDFVenda(vendas) {
    try {
      const directory = 'C:/Suporte_linx/ordem_producao';
      if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
      }
      
  
      const vendaId = vendas[0].venda_id;
      const fileName = `${directory}/ordem_de_producao_ID_${vendaId}.pdf`;
      const doc = new PDFDocument({
        size: [200, 800],
        margin: 10
      });
      const writeStream = fs.createWriteStream(fileName);
  
      writeStream.on('error', (error) => {
        throw error;
      });
  
      doc.pipe(writeStream);
  
      // const imagePath = './logo.png';
      // doc.image(imagePath, {
      //   fit: [200, 200],
      //   align: 'center',
      //   x: 0,
      //   y: -50,
      // });
  
      doc.font('Helvetica-Bold').fontSize(14).text('\n\n\n\n ORDEM DE PRODUÇÃO\n', {
        align: 'center'
      });
  
      const dataHoraAtual = new Date().toLocaleString('pt-BR');
      doc.font('Helvetica').fontSize(10).text(`Data Pedido: ${dataHoraAtual}`, {
        align: 'center'
      });
      doc.font('Helvetica').fontSize(10).text(`Número Pedido: ${vendaId}`, {
        align: 'center'
      });
  
      for (const venda of vendas) {
        const { produto_nome, produto_composicao, produto_complemento, produto_preparo } = venda;

         // Ignora este produto específico se o nome contiver "ADICIONAL"
    if (produto_nome && produto_nome.toUpperCase().includes('ADICIONAL')) {
      console.log(`Produto "${produto_nome}" ignorado por conter "ADICIONAL".`);
      continue; // Pula este produto e vai para o próximo
  }
  
        let composicaoFormatada = '';
  
        if (produto_composicao) {
        const composicao1 = JSON.parse(produto_composicao);
        const composicaoFiltrada = composicao1.filter(item => ![
          'POTE PERSONALIZADO 100ML',
          'POTE PERSONALIZADO 200ML',
          'POTE PERSONALIZADO 500ML',
          'COPO PERSONALIZADO 300ML',
          'COPO PERSONALIZADO 500ML',
          'COPO PERSONALIZADO 700ML',
          'COLHER LONGA ACAI',
          'GUARDANAPO ENVELOPADO SIMPLES',
          'TAMPA BOLHA COPO C FURO 300 ML',
          'TAMPA BOLHA COPO C FURO 500 ML',
          'TAMPA BOLHA COPO C FURO 700 ML',
          'TAMPA BOLHA COPO S FURO 300 ML',
          'TAMPA BOLHA COPO S FURO 500 ML',
          'TAMPA BOLHA COPO S FURO 700 ML',
          'TAMPA PAPEL TERMO PARA POTE 100 ML',
          'TAMPA PAPEL TERMO PARA POTE 200 ML',
          'TAMPA PAPEL TERMO PARA POTE 500 ML',
          'TAMPA PET PARA POTE RETO 100 ML',
          'TAMPA PET PARA POTE RETO 200 ML',
          'TAMPA PET PARA POTE RETO 500 ML',
          'TAMPA RETA P COPO 700 ML',
          'LACRE PARA COPO E TAMPA PERSONALIZADO',
          'GARRAFA PET TRANSPARENTE 300ML',
          'GARRAFA PET TRANSPARENTE 500ML',
          'SACHE AÇUCAR CRISTAL',
          'SACHE ADOÇANTE',
          'CANUDO SUPER ACAI 10MM',
          'PORTA COPOS',
          'PAZINHA PLAST PEQUENA BRANCA',
          'PORTA COPOS PERSONALIZADO',
          'PORTA CASQUINHA',
          'PAZINHA PLAST PEQUENA COLOR MISTA',
          'GUARDANAPO PERSONALIZADO CREPIL',
          'GUARDANAPO DE MESA BRANCO',
          'CASCAO',
          'ADESIVO FECHA SACO PERSONALIZADO',
          'ADESIVO FECHA COPO PERSONALIZADO'
        ].includes(item.descricao));
  
        // const composicao2Encontrada = venda.produto_composicao && venda.produto_composicao.startsWith('[{"contem": null, "hash": null,');
  
        // if (composicao2Encontrada) {
        //   console.log('Composição 2 encontrada. Ignorando impressão e passando para a próxima venda.');
        //   continue;
        // }
  
        for (const item of composicaoFiltrada) {
          composicaoFormatada += `${item.descricao} - ${item.quantidade} ${item.unid_med}\n`;
        }
       } else {
          console.log(`produto_composicao está vazio para o produto ${produto_nome}`);
      }
  
        let adicionalFormatado = '';
        if (produto_complemento) {
          const adicional = JSON.parse(produto_complemento);
          adicional.forEach(item => {
            if (/^ADICIONAL\s+/i.test(item.descricao)) {
              const descricaoFormatada = item.descricao.replace(/^ADICIONAL\s+/i, '');
              adicionalFormatado += `${descricaoFormatada} - ${item.quantidade} ${item.unid_med}\n`;
            } else {
              adicionalFormatado += `${item.descricao} - ${item.quantidade} ${item.unid_med}\n`;
            }
          });
        }
  
        let preparoFormatado = '';
        if (produto_preparo && typeof produto_preparo === 'string') {
          const preparoTexto = JSON.parse(produto_preparo);
          preparoTexto.forEach(item => {
            preparoFormatado += `${item.descricao}\n`;
          });
        }
  
       // Consulta SQL para obter a coluna 'obs' da tabela 'movto.nota_fiscal'
        const query = `
        SELECT obs
        FROM movto.nota_fiscal
        WHERE venda_id = $1
        `;
        const { rows: notaFiscal } = await pool.query(query, [venda.venda_id]);
        let clienteObs = '';
        if (notaFiscal.length > 0) {
            const obs = notaFiscal[0].obs;
            const match = /OPERADOR: ((?:\S+\s+){3})([\s\S]*)/.exec(obs);
            if (match && match[2]) {
            clienteObs = match[2];
            }
        }

        doc
          .font('Helvetica-Bold').fontSize(12).text(`\nPRODUTO:`).font('Helvetica').fontSize(9).text(`${produto_nome}\n\n`)
          .font('Helvetica-Bold').fontSize(12).text(`COMPOSIÇÃO:\n`).font('Helvetica').fontSize(9).text(`${composicaoFormatada}\n`)
          .font('Helvetica-Bold').fontSize(12).text(`ADICIONAL:\n`).font('Helvetica').fontSize(9).text(`${adicionalFormatado}\n`)
          .font('Helvetica-Bold').fontSize(12).text('\nOBSERVAÇÃO DE PREPARO: ').font('Helvetica').fontSize(9).text(`${preparoFormatado}\n`)
          .font('Helvetica-Bold').fontSize(12).text('CLIENTE: ').font('Helvetica').text(`${clienteObs}\n`, { bold: true, fontSize: 20 }).fontSize(20);
  
        const yPosition = doc.y;
        doc.moveTo(0, yPosition + 0)
          .lineTo(210, yPosition + 0)
          .stroke();
      }
  
      doc.end();
  
      await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });
  
      console.log(`Arquivo PDF salvo em ${fileName}`);
  
      //await pdfToPrinter.print(fileName, { printer: '\\\\DESKTOP-9QK0EOJ\\ELGINI9' });
      //console.log('Documento enviado para impressora com sucesso.');
      
   
    } catch (error) {
      console.error('Erro ao imprimir PDF:', error);
      throw error;
    }
  }

// Rota para receber novas vendas
app.post('/nova-venda', async (req, res) => {
    try {
        
        const novaVenda = req.body;
        await imprimirPDFVenda(novaVenda);
        res.status(200).send('Venda recebida com sucesso e PDF gerado.');
    } catch (error) {
        console.error('Erro ao processar nova venda:', error);
        res.status(500).send('Erro ao processar nova venda.');
    }
});

// Inicialização do servidor
app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});

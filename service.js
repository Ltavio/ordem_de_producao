const Service = require('node-windows').Service;
const path = require('path');

// Caminho para o seu script Node.js
const scriptPath = path.join(__dirname, 'index.js');

// Crie um novo serviço
const svc = new Service({
  name: 'Linx Producao',
  description: 'Ordem de produção de vendas',
  script: scriptPath,
  nodeOptions: [
    '--harmony',
    '--max_old_space_size=4096'
  ]
});

// Instale o serviço
svc.on('install', () => {
  svc.start();
});

svc.on('alreadyinstalled', () => {
  console.log('Serviço já está instalado.');
});

svc.on('invalidinstallation', () => {
  console.error('Instalação inválida.');
});

svc.on('error', (error) => {
  console.error(`Erro ao instalar serviço: ${error}`);
});

// Instale e inicie o serviço
svc.install();

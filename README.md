# Personal Trainer Webhook - Deploy

## Deploy no Easypanel

### 1. Acesse o Easypanel
https://easypanel.n8nlendario.online/

### 2. Crie um novo App
- Clique em **+ Create** → **App**
- Nome: `trainer-webhook`
- Tipo: **Node.js** ou **Docker**

### 3. Se usar Node.js App:
- Upload dos arquivos ou conecte ao Git
- Set **Build Command**: (deixe vazio)
- Set **Start Command**: `node webhook-server.js`

### 4. Configure as variáveis de ambiente:

```
PORT=3847
UAZAPI_BASE_URL=https://jcarlosamorimppt.uazapi.com
UAZAPI_TOKEN=5c7123b0-34ac-462c-8f5b-f0298586e10c
NOTIFICATION_NUMBER=5592981951096
```

### 5. Configure o domínio
- Em **Domains**, adicione: `trainer.n8nlendario.online`
- Ou use o domínio padrão do Easypanel

### 6. Deploy!
- Clique em **Deploy**
- Aguarde o build

### 7. Configure o webhook no UazAPI
- Vá em https://jcarlosamorimppt.uazapi.com
- Configure o webhook URL: `https://trainer.n8nlendario.online/webhook`

---

## Via SSH (alternativa)

### 1. Conecte à VPS
```bash
ssh root@82.25.74.224
```

### 2. Instale Node.js e PM2
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pm2
```

### 3. Crie o diretório e copie os arquivos
```bash
mkdir -p /opt/trainer-webhook
cd /opt/trainer-webhook
```

### 4. Crie o arquivo .env
```bash
cat > .env << 'EOF'
PORT=3847
UAZAPI_BASE_URL=https://jcarlosamorimppt.uazapi.com
UAZAPI_TOKEN=5c7123b0-34ac-462c-8f5b-f0298586e10c
NOTIFICATION_NUMBER=5592981951096
EOF
```

### 5. Inicie com PM2
```bash
pm2 start webhook-server.js --name trainer-webhook
pm2 save
pm2 startup
```

### 6. Configure Nginx (proxy reverso)
```bash
apt install -y nginx

cat > /etc/nginx/sites-available/trainer << 'EOF'
server {
    listen 80;
    server_name trainer.n8nlendario.online;

    location / {
        proxy_pass http://127.0.0.1:3847;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

ln -s /etc/nginx/sites-available/trainer /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

### 7. SSL com Certbot
```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d trainer.n8nlendario.online
```

---

## Arquivos

- `webhook-server.js` - Servidor principal
- `whatsapp.js` - Integração UazAPI
- `scheduler.js` - Gerenciamento de estado
- `package.json` - Dependências

## Variáveis de Ambiente

| Variável | Descrição |
|----------|-----------|
| PORT | Porta do servidor (default: 3847) |
| UAZAPI_BASE_URL | URL base do UazAPI |
| UAZAPI_TOKEN | Token de autenticação UazAPI |
| NOTIFICATION_NUMBER | Seu número WhatsApp |

# Deploy

## Termux

Instala dependencias:

```bash
pkg update -y
pkg install -y nodejs-lts git pnpm frp openssh termux-api
```

Clona el repo:

```bash
cd ~
git clone <TU_REPO> poco-cloud
cd poco-cloud
pnpm install
pnpm build
```

Configura variables:

```bash
cp ~/poco-cloud/infra/termux/poco-cloud.env.example ~/poco-cloud.env
nano ~/poco-cloud.env
```

Deploy completo:

```bash
chmod +x ~/poco-cloud/infra/termux/deploy.sh
~/poco-cloud/infra/termux/deploy.sh
```

## Termux:Boot

Copia el script:

```bash
mkdir -p ~/.termux/boot
cp ~/poco-cloud/infra/termux/boot-poco-cloud.sh ~/.termux/boot/start-poco-cloud.sh
chmod +x ~/.termux/boot/start-poco-cloud.sh
```

Configura Android:

- Termux: sin restricciones de bateria.
- Termux:Boot: inicio automatico permitido.
- Ejecuta Termux:Boot una vez tras instalarlo.

## frp

En el Poco F3:

```bash
cp ~/poco-cloud/infra/frp/frpc.toml ~/frpc.toml
nano ~/frpc.toml
frpc -c ~/frpc.toml
```

El token debe coincidir con `/etc/frp/frps.toml` en el VPS.

## VPS

Puertos necesarios:

- `80/tcp`
- `443/tcp`
- `7000/tcp`
- `22/tcp` restringido si es posible

Caddy:

```bash
sudo cp infra/caddy/Caddyfile /etc/caddy/Caddyfile
sudo systemctl restart caddy
```

frps:

```toml
bindPort = 7000
auth.method = "token"
auth.token = "MISMO_TOKEN_SECRETO"
```

## Primer usuario

Con la API levantada:

```bash
curl -X POST https://YOUR_DOMAIN/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"usa-una-frase-larga-unica","displayName":"Admin"}'
```

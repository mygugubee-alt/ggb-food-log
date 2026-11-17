# Hosting GGB Food Log with Docker (behind your own Caddy)

The app is a set of static files served by nginx inside one small container.
It keeps nothing on the server: every visitor's entries and photos stay in their own browser.
This package does NOT start its own Caddy or any other proxy. You use the one you already run.

## What you need

- A VPS with Docker (and Docker Compose v2.24 or newer).
- Your existing Caddy, serving a domain name over HTTPS. Phones only allow "Add to Home Screen"
  and offline use over HTTPS.

## 1. Copy and unpack

    scp ggb-food-log-source.zip user@YOUR_VPS_IP:~
    ssh user@YOUR_VPS_IP
    mkdir -p ggb-food-log && cd ggb-food-log && unzip -o ../ggb-food-log-source.zip

## 2. Start the app (choose A or B)

### A) Your Caddy runs directly on the VPS (not in Docker)

    docker compose -f docker-compose.host.yml up -d --build

The app listens on all interfaces, port 8080. If this machine has a public IP, block 8080 from outside (or allow only your Caddy machine), otherwise people can bypass Caddy and HTTPS. To restrict it, put `BIND=127.0.0.1` (or a LAN IP) in a `.env` file.

**Caddy on a different machine?** Use `reverse_proxy <this-machine-LAN-IP>:8080` in that Caddy's Caddyfile. If you restricted `BIND` to 127.0.0.1 it will fail with 502.
Add to your Caddyfile and reload Caddy:

    food.example.com {
        reverse_proxy 127.0.0.1:8080
    }

To use another port: `PORT=9090 docker compose -f docker-compose.host.yml up -d --build`.

### B) Your Caddy runs in Docker

Find the network your Caddy container is on:

    docker network ls
    docker inspect <your-caddy-container> --format '{{json .NetworkSettings.Networks}}'

Save the network name in a `.env` file next to the compose files (replace the name). Compose reads it
automatically, so later commands such as `down`, `logs` and `ps` work too:

    echo 'CADDY_NETWORK=your_caddy_network' > .env
    docker compose -f docker-compose.host.yml -f docker-compose.network.yml up -d --build

Add to your Caddyfile and reload Caddy:

    food.example.com {
        reverse_proxy ggb-food-log:80
    }

Reload Caddy without downtime, for example:

    docker exec <your-caddy-container> caddy reload --config /etc/caddy/Caddyfile

To stop it later: add the same `-f` options and `down`, for example
`docker compose -f docker-compose.host.yml -f docker-compose.network.yml down`.

## 3. Check it

    docker ps                       # ggb-food-log should be "Up"
    curl -I https://food.example.com

## Updating

Unpack the new zip over the old folder and run the same `up -d --build` command.
Phones show "New version available. Reload". Data is not touched.

## Moving your data to the phone

On the computer where you used the app: Settings -> Export data.
On the phone, after adding the hosted app to the home screen: Settings -> Import data.

## Ready-made image (optional, ARM servers only)

`ggb-food-log-image-arm64.tar.gz` only runs on ARM 64-bit machines. Most VPSs are Intel/AMD:
use the source zip instead.

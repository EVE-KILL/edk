FROM oven/bun:alpine
WORKDIR /app
COPY . .
RUN bun install

COPY --from=docker.io/ochinchina/supervisord:latest /usr/local/bin/supervisord /usr/local/bin/supervisord
COPY ./.supervisor.conf /etc/supervisor/conf.d/supervisor.conf

EXPOSE 3000
CMD [ "/usr/local/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisor.conf" ]

FROM oven/bun:alpine
WORKDIR /app
COPY . .
RUN bun install && \
    apk update && \
    apk add bash supervisor

COPY ./.supervisor.conf /etc/supervisor/conf.d/supervisor.conf

EXPOSE 3000
CMD [ "supervisord", "-c", "/etc/supervisor/conf.d/supervisor.conf" ]

FROM postgres:16-alpine
RUN apk add --no-cache openssl tzdata
COPY deploy/backup.sh deploy/restore.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/restore.sh
CMD ["/usr/local/bin/backup.sh", "--daemon"]

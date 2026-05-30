FROM node:22-alpine

WORKDIR /app

COPY server.mjs ./server.mjs

ENV NODE_ENV=production
ENV PORT=8080
ENV LAW_API_PROTOCOL=https
ENV LAW_OPEN_API_REFERER=https://gyo6.kr/

CMD ["node", "server.mjs"]

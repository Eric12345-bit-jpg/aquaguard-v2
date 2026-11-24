FROM node:20-alpine
WORKDIR /app
COPY package.json ./
COPY index.html ./
COPY app.config.ts ./
COPY local-server.mjs ./
COPY README.md ./
COPY public ./public
COPY src ./src
COPY lib ./lib
COPY docs ./docs
COPY supabase ./supabase
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.mjs"]

FROM docker.io/library/node:20-alpine

WORKDIR /workspace

COPY package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

RUN npm install

COPY apps/api apps/api

RUN npm run build --workspace=@educar/api

CMD ["npm", "run", "start", "--workspace=@educar/api"]

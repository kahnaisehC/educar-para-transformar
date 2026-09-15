FROM docker.io/library/node:20-alpine

WORKDIR /workspace

COPY package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

RUN npm install

COPY apps/web apps/web

CMD ["npm", "run", "dev", "--workspace=@educar/web", "--", "--host", "0.0.0.0"]

FROM node:20-alpine

WORKDIR /srv

COPY package.json ./
RUN npm install

COPY . .

# Next.js inlines NEXT_PUBLIC_* into the client bundle at build time, so this
# must be a build arg — setting it at runtime has no effect on the browser.
ARG NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]

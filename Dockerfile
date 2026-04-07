FROM node:20
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# Hugging Face nutzt Port 7860 standardmäßig
ENV PORT=7860
EXPOSE 7860
CMD ["node", "server.js"]

# Node.js 14の軽量イメージを使用
FROM node:14-slim

# 作業ディレクトリを設定
WORKDIR /app

# 依存関係をコピーしてインストール
COPY package*.json ./
RUN npm install --production

# アプリケーションコードをコピー
COPY . .

# 環境変数でポートを設定（Cloud Runのデフォルト）
ENV PORT=8080
EXPOSE 8080

# アプリケーション起動
CMD ["npm", "start"]
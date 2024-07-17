
# devio2024-sample-code

## はじめに

本プロジェクトは、セッション「サーバーレスAPI(API Gateway+Lambda)とNext.jsで個人ブログを作ろう！」で登場するサンプルコードをまとめたものです。

基本的に技術検証コードになりますので、参考程度に活用してください。


## ディレクトリ構成

本プロジェクトは、セッション「サーバーレスAPI(API Gateway+Lambda)とNext.jsで個人ブログを作ろう！」で登場するサンプルコードをまとめたものです。

|packages配下|説明|技術
|---|---|---|
|blog-api|サーバレスAPI ローカル起動可(後述)|Node.js Hono
|blog-web|Webアプリ Vercelでデプロイすることを想定|Next.js
|config|biome tsconfigの設定|
|documents|スライドに乗っているシーケンス|Asciidoc PlantUML
|iac|サーバーレスAPIのIaC|CDK


## 開発方法

### 1. 事前に用意するもの

* ドメイン
  * NSレコードの設定方法を事前に調査
  * packages/iac/lib/config.tsのdevのdomainNameに指定

用意できない場合は以下のスタック定義を削除してください

* route53Stack
* certificationStack

2. CDKの初期化

`iac`ディレクトリ以外で実施してください

```bash
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query "Account" --output text)
pnpm cdk bootstrap aws://$CDK_DEFAULT_ACCOUNT/ap-northeast-1
pnpm cdk bootstrap aws://$CDK_DEFAULT_ACCOUNT/us-east-1
```

### 2. スタックのデプロイ

```bash
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query "Account" --output text)

pnpm \
  -F @shuntaka-dev/iac \
  run cdk deploy -c envName='dev' \
  dev-shuntaka-dev-blog-api
```

### 3. スタックのデプロイ中にやること

* デプロイしてすぐにRoute53のHostedZoneができるので、ドメインを取得したサイトでNSレコードの設定をしてください(しないとCDKデプロイがタイムアウトします)

### 4. 起動

```bash
pnpm run dev
```

## 補足

Q. 構築時の手動作業はありますか

* ドメインの取得(ローカルだけなら必要なし)
* フロント側
  * Vercelへホスティング設定
    * packages/blog-webを指定
  * Vercelへドメイン/証明書設定
* サーバー側
  * iacデプロイ時に、ドメイン取得元にRoute53のHostedZoneのNSレコード追加(※ ドメインと証明書はIaC側で自動設定)

Q. ドメイン設定はどのような想定ですか

仮にhoge.jpドメインを取得した場合

|要素|ドメイン|ローカル|
|---|---|---|
|サーバー|api.hoge.jp|localhost:3001
|webアプリ|hoge.jp|localhost:3000


Q. Cookieの設定はどうなっていますか

* SameSite=Lax
* Secure
* HttpOnly
* domain(取得ドメイン)

Q. ローカルで動作しますか

します。以下が必要です。これはlocalhostでは、HttpOnly, Secure, domain属性が特例になるためです

* iacのデプロイ(route53StackとcertificationStackはなくてもOK)
* 上記があるAWS環境へのassume role


## 付録

### コマンド

|コマンド|説明|補足|
|---|---|---|
|`pnpm run lint`|静的解析|
|`pnpm run fix`|フォーマット|
|`pnpm run fix -- --unsafe`|
|`pnpm run test`|テスト実行|
|`pnpm run dev`|アプリケーション実行|


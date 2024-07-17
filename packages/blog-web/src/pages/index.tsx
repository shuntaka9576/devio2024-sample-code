import Layout from '@/components/layout';
import Head from 'next/head';

export default function Home() {
  return (
    <>
      <Head>
        <title>ブログプロトタイピング</title>
        <meta name="description" content="SimpleWebAuthn Example Site" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Layout>
        {/* ここにメインコンテンツを追加できます（必要な場合） */}
        <div />
      </Layout>
    </>
  );
}

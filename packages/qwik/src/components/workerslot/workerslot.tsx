import { component$, useMount$, useStore } from '@builder.io/qwik';

export interface Doc {
  uid: string,
  lang: string,
  wild?: string,
  frontmatter: Object,
  articleBody: string
}

export const Workerslot = component$(() => {
  const doc: Doc = useStore<Doc>({
    uid: '',
    lang: '',
    wild: '',
    frontmatter: {},
    articleBody: ''
  })
  useMount$(async () => {
    const res = await fetch(`https://worktop.francois-vidit.workers.dev/docs/ja/versailles/palais/hercule`, {headers: { 'Accept': 'application/json' }});
    const json = await res.json() as Doc;
    doc.uid = json.uid;
    doc.lang = json.lang;
    doc.wild = json.wild;
    doc.frontmatter = json.frontmatter;
    doc.articleBody = json.articleBody;
  })
  return (
    <div dangerouslySetInnerHTML={`${doc.articleBody}`}>
    </div>
  );
});
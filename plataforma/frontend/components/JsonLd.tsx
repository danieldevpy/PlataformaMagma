/**
 * Dados estruturados (schema.org). O replace de `<` evita fechamento
 * prematuro da tag <script> por conteúdo vindo do CMS.
 */
export default function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

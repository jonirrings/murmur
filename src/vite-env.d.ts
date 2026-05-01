/// <reference types="@cloudflare/workers-types" />

declare module "*.css" {
  const content: string;
  export default content;
}

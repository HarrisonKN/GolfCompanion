declare module 'crypto-js/sha256' {
  function SHA256(message: string): any;
  export default SHA256;
}

declare module 'crypto-js/enc-base64' {
  interface WordArray {
    toString(encoding?: any): string;
  }
  const enc: {
    Base64: {
      stringify(wordArray: any): string;
      parse(str: string): any;
    };
  };
  export default enc;
}

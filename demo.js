import FirecrawlApp from '@mendable/firecrawl-js';
const firecrawl = new FirecrawlApp({
  apiKey: '',
  apiUrl: "http://localhost:3002",
});

// const result = await firecrawl.search("What is the capital of France?", {
//     timeout: 15000,
//     limit: 5,
//     scrapeOptions: { formats: ['markdown'] },
//   });

  // const result = await firecrawl.crawlUrl("https://www.joshwcomeau.com/", {
//     maxDepth: 2,
//     limit: 5,
//     scrapeOptions: {
//         formats: ['markdown']
//     }
//   });

  const result = await firecrawl.scrapeUrl("https://www.joshwcomeau.com/");

//   console.log(result);
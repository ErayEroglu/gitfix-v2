// // pages/api/callback.js

// import { verifySignature } from "@upstash/qstash/nextjs";

// function handler(req, res) {
//   // responses from qstash are base64-encoded
//   const decoded = atob(req.body.body);
//   console.log(decoded);

//   return res.status(200).end();
// }

// export default verifySignature(handler);

// export const config = {
//   api: {
//     bodyParser: false,
//   },
// };

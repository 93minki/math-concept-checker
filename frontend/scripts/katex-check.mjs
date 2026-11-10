import katex from "katex";

let input = "";
for await (const chunk of process.stdin) input += chunk;
const formulas = JSON.parse(input);
const errors = [];
for (const [index, tex] of formulas.entries()) {
  try {
    katex.renderToString(tex, { throwOnError: true });
  } catch (error) {
    errors.push({ index, message: error.message });
  }
}
process.stdout.write(JSON.stringify(errors));

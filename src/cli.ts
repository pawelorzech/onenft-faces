import { faceOfDay, svgOf, attributesOf } from "./faces.ts";

const from = Number(process.argv[2] ?? "20701");
const count = Number(process.argv[3] ?? 1);

for (let i = 0; i < count; i++) {
  const t = faceOfDay(from + i);
  const file = `out/day-${from + i}.svg`;
  await Bun.write(file, svgOf(t));
  console.log(`${file}  ${attributesOf(t).map((a) => a.value).join(", ")}`);
}

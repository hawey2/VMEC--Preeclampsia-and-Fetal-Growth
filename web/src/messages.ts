import type { Lang } from "./i18n";

const viComp: Record<string, string> = { prior: "tiên nghiệm", mom: "MoM", likelihood: "kết hợp chỉ số", truncation: "giới hạn MoM" };
const viLevel: Record<string, string> = {
  transcribed_signs_inferred: "dấu suy luận",
  transcribed: "mới chép một lần",
  secondary_source: "nguồn thứ cấp",
  missing: "thiếu",
};
const viParts = (s: string) =>
  s.replace(/(\w+) \((\w+)\)/g, (_, c: string, l: string) => `${viComp[c] ?? c} (${viLevel[l] ?? l})`);

/** Vietnamese versions of the engine/API messages, which are written in English. */
const rules: [RegExp, (m: RegExpExecArray) => string][] = [
  [/^Coefficients not verified, not for clinical use: (.*)\.$/, (m) => `Hệ số chưa được kiểm định, chưa dùng lâm sàng: ${viParts(m[1])}.`],
  [/^Coefficients for '(\w+)' are '(\w+)', not verified: not for clinical use\.$/, (m) => `Hệ số '${m[1]}' ở mức '${m[2]}', chưa kiểm định: chưa dùng lâm sàng.`],
  [/^Interpregnancy interval (\S+) y raised to (\S+) y for the prior model \(unvalidated bound\)\.$/, (m) => `Khoảng cách giữa hai thai ${m[1]} năm được nâng lên ${m[2]} năm trong mô hình tiên nghiệm (giới hạn chưa kiểm định).`],
  [/^UtA-PI needs both left and right values; UtA-PI not used\.$/, () => "Cần cả UtA-PI trái và phải; chưa dùng UtA-PI."],
  [/^PlGF analyser not given; PlGF not used\.$/, () => "Chưa chọn máy xét nghiệm PlGF; chưa dùng PlGF."],
  [/^(\w+) MoM (\S+) outside (\S+)-(\S+); truncated\.$/, (m) => `MoM ${m[1]} ${m[2]} nằm ngoài ${m[3]}–${m[4]}; đã cắt về giới hạn.`],
  [/^Biomarker likelihood parameters are missing.*$/, () => "Thiếu tham số kết hợp chỉ số sinh học; chỉ hiện nguy cơ từ yếu tố mẹ."],
  [/^Vanishing twin recorded.*$/, () => "Có ghi nhận thai tiêu biến: mô hình không hiệu chỉnh; PlGF có thể bị ảnh hưởng."],
  [/^Ophthalmic artery PSV ratio is recorded but not used.*$/, () => "Tỉ số PSV động mạch mắt được ghi nhận nhưng không dùng để tính nguy cơ (chưa có mô hình đã công bố)."],
  [/^fetal heart activity is absent.*$/, () => "Không có hoạt động tim thai: không áp dụng đánh giá nguy cơ."],
  [/^previous delivery date must be before this conception$/, () => "Ngày sinh lần trước phải trước thời điểm thụ thai lần này."],
  [/^PlGF sample must be taken at 11\+0 to 13\+6 weeks$/, () => "Mẫu PlGF phải lấy ở tuổi thai 11+0 đến 13+6 tuần."],
  [/^CRL (\S+) mm is outside 45-84 mm.*$/, (m) => `CRL ${m[1]} mm nằm ngoài khoảng 45–84 mm (11+0 đến 13+6 tuần).`],
  [/^BPD (\S+) mm is outside 15-28 mm.*$/, (m) => `BPD ${m[1]} mm nằm ngoài khoảng 15–28 mm (khoảng 11–13 tuần).`],
  [/^gestational age (\S+) days is outside 11\+0 to 13\+6 weeks.*$/, (m) => `Tuổi thai ${m[1]} ngày nằm ngoài 11+0 đến 13+6 tuần.`],
  [/^days must be 0-6$/, () => "Số ngày phải từ 0 đến 6."],
];

export function msg(text: string, lang: Lang): string {
  if (lang === "en") return text;
  for (const [re, f] of rules) {
    const m = re.exec(text);
    if (m) return f(m);
  }
  return text;
}

/** One line for all "coefficients not verified" notes so the report stays short. */
export function compactWarnings(ws: string[]): string[] {
  const coef = ws.map((w) => /^Coefficients for '(\w+)' are '(\w+)'/.exec(w)).filter((m): m is RegExpExecArray => !!m);
  const rest = ws.filter((w) => !/^Coefficients for '/.test(w));
  if (!coef.length) return rest;
  return [`Coefficients not verified, not for clinical use: ${coef.map((m) => `${m[1]} (${m[2]})`).join(", ")}.`, ...rest];
}

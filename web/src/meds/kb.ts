/**
 * Medication knowledge base for the preeclampsia pathway: drugs (oral and injectable), foods and
 * supplements, and the rules the checker applies to them. One file, both languages side by side, so a
 * pharmacist reviews each rule once. Severity comes from here, never from a language model.
 *
 * NOT VERIFIED: written from the sources listed below and not yet reviewed by a Vinmec clinical
 * pharmacist and obstetrician. `KB_META.verified` stays false until that review is signed.
 */

export type Lang2 = { vi: string; en: string };

/** Antenatal before 20 weeks, 20 to 35+6 weeks, from 36 weeks, after delivery. */
export type Phase = "lt20" | "w20to36" | "ge36" | "postpartum";
export const PHASES: Phase[] = ["lt20", "w20to36", "ge36", "postpartum"];
const ANTENATAL: Phase[] = ["lt20", "w20to36", "ge36"];

/** Patient conditions the checker asks about, because they change what is safe. */
export type Flag = "asthma" | "oliguria" | "coagulopathy" | "neuraxial" | "severe_htn";
export const FLAGS: Flag[] = ["severe_htn", "oliguria", "coagulopathy", "asthma", "neuraxial"];

/** Regular medicines (oral or subcutaneous), injectables given on the ward, foods and supplements. */
export type Kind = "regular" | "injectable" | "food";
export type Level = "avoid" | "caution" | "separate" | "info";
/** Who acts on the finding: the prescriber, the nurse or midwife giving the drug, the anaesthetist. */
export type Actor = "prescriber" | "nurse" | "anaesthetist";
/** Where the evidence comes from; most interaction data are from non-pregnant adults. */
export type Evidence = "pregnancy_trial" | "non_pregnant" | "mechanism" | "guideline";

export type Item = { id: string; kind: Kind; name: Lang2; groups?: string[] };

export type Rule = {
  id: string;
  level: Level;
  actor: Actor;
  evidence: Evidence;
  /** Every reference must match a different selected item (by id or group). Empty = no drug needed. */
  all: string[];
  phases?: Phase[];
  flags?: Flag[];
  effect: Lang2;
  manage: Lang2;
  sources: string[];
};

export type Source = { id: string; label: string; url?: string };

export const KB_META = { version: "2026-11-19", verified: false };

export const SOURCES: Source[] = [
  { id: "aspre", label: "Rolnik 2017, N Engl J Med (ASPRE)", url: "https://doi.org/10.1056/NEJMoa1704559" },
  { id: "adherence", label: "Rolnik 2026, Am J Obstet Gynecol", url: "https://doi.org/10.1016/j.ajog.2026.02.014" },
  { id: "statin", label: "Döbert 2021, Circulation (STATIN)", url: "https://doi.org/10.1161/CIRCULATIONAHA.121.053963" },
  { id: "isshp", label: "ISSHP 2021, Pregnancy Hypertens", url: "https://doi.org/10.1016/j.preghy.2021.09.008" },
  { id: "nsaid_pp", label: "Blue 2018; Triebwasser 2019; Penfield 2025 (RCTs)", url: "https://doi.org/10.1016/j.ajog.2025.02.012" },
  { id: "fda_nsaid", label: "FDA Drug Safety Communication, Oct 2020 (NSAIDs from 20 weeks)" },
  { id: "mgso4", label: "Idama 1998, Br J Obstet Gynaecol", url: "https://doi.org/10.1111/j.1471-0528.1998.tb10084.x" },
  { id: "mg_errors", label: "Simpson 2004, MCN", url: "https://doi.org/10.1097/00005721-200405000-00006" },
  { id: "pumps", label: "Schnock 2017, BMJ Qual Saf", url: "https://doi.org/10.1136/bmjqs-2015-004465" },
  { id: "delay", label: "Kantorowska 2020, Am J Obstet Gynecol", url: "https://doi.org/10.1016/j.ajog.2020.02.009" },
  { id: "grapefruit", label: "Bailey 2013, CMAJ", url: "https://doi.org/10.1503/cmaj.120951" },
  { id: "who_calcium", label: "WHO recommendation on calcium supplementation in pregnancy" },
  { id: "label", label: "Product information (SmPC) of each drug" },
];

export const ITEMS: Item[] = [
  // Regular medicines (oral or subcutaneous)
  { id: "aspirin", kind: "regular", name: { vi: "Aspirin liều thấp", en: "Low-dose aspirin" }, groups: ["antiplatelet"] },
  { id: "nifedipine", kind: "regular", name: { vi: "Nifedipin", en: "Nifedipine" }, groups: ["ccb", "antihypertensive"] },
  { id: "labetalol_po", kind: "regular", name: { vi: "Labetalol uống", en: "Labetalol, oral" }, groups: ["beta_blocker", "antihypertensive"] },
  { id: "methyldopa", kind: "regular", name: { vi: "Methyldopa", en: "Methyldopa" }, groups: ["antihypertensive"] },
  { id: "acei_arb", kind: "regular", name: { vi: "Ức chế men chuyển / chẹn thụ thể angiotensin (enalapril, losartan…)", en: "ACE inhibitor / ARB (enalapril, losartan…)" }, groups: ["acei_arb"] },
  { id: "paracetamol", kind: "regular", name: { vi: "Paracetamol", en: "Paracetamol" } },
  { id: "nsaid", kind: "regular", name: { vi: "NSAID (ibuprofen, diclofenac, naproxen…)", en: "NSAID (ibuprofen, diclofenac, naproxen…)" }, groups: ["nsaid"] },
  { id: "salicylate_otc", kind: "regular", name: { vi: "Thuốc không kê đơn chứa salicylat (bismuth subsalicylat, một số thuốc cảm)", en: "OTC product with salicylate (bismuth subsalicylate, some cold remedies)" }, groups: ["salicylate"] },
  { id: "ssri", kind: "regular", name: { vi: "Thuốc chống trầm cảm SSRI/SNRI", en: "SSRI/SNRI antidepressant" }, groups: ["ssri"] },
  { id: "prednisolone", kind: "regular", name: { vi: "Corticosteroid uống dài ngày (prednisolon…)", en: "Long-term oral corticosteroid (prednisolone…)" }, groups: ["steroid_long"] },
  { id: "insulin", kind: "regular", name: { vi: "Insulin hoặc thuốc hạ đường huyết", en: "Insulin or glucose-lowering drug" }, groups: ["hypoglycaemic"] },
  { id: "lmwh", kind: "regular", name: { vi: "Heparin trọng lượng phân tử thấp (enoxaparin) tiêm dưới da", en: "Low-molecular-weight heparin (enoxaparin), subcutaneous" }, groups: ["anticoagulant"] },
  { id: "calcium", kind: "regular", name: { vi: "Canxi bổ sung", en: "Calcium supplement" }, groups: ["calcium"] },
  { id: "iron", kind: "regular", name: { vi: "Viên sắt", en: "Iron tablets" }, groups: ["iron"] },
  { id: "pravastatin", kind: "regular", name: { vi: "Pravastatin", en: "Pravastatin" } },
  // Injectable medicines on the labour ward
  { id: "mgso4", kind: "injectable", name: { vi: "Magie sulfat tĩnh mạch", en: "Magnesium sulphate IV" }, groups: ["magnesium"] },
  { id: "labetalol_iv", kind: "injectable", name: { vi: "Labetalol tĩnh mạch", en: "Labetalol IV" }, groups: ["beta_blocker", "antihypertensive"] },
  { id: "hydralazine_iv", kind: "injectable", name: { vi: "Hydralazin tĩnh mạch", en: "Hydralazine IV" }, groups: ["antihypertensive"] },
  { id: "heparin_iv", kind: "injectable", name: { vi: "Heparin không phân đoạn", en: "Unfractionated heparin" }, groups: ["anticoagulant"] },
  { id: "oxytocin", kind: "injectable", name: { vi: "Oxytocin", en: "Oxytocin" } },
  { id: "gentamicin", kind: "injectable", name: { vi: "Gentamicin (aminoglycosid)", en: "Gentamicin (aminoglycoside)" }, groups: ["aminoglycoside"] },
  { id: "nmb", kind: "injectable", name: { vi: "Thuốc giãn cơ khi gây mê (rocuronium, suxamethonium…)", en: "Neuromuscular blocker (rocuronium, suxamethonium…)" }, groups: ["nmb"] },
  // Foods and supplements
  { id: "grapefruit", kind: "food", name: { vi: "Bưởi chùm (grapefruit) hoặc nước ép", en: "Grapefruit or its juice" } },
  { id: "pomelo", kind: "food", name: { vi: "Bưởi (pomelo)", en: "Pomelo" } },
  { id: "ginkgo", kind: "food", name: { vi: "Bạch quả (ginkgo)", en: "Ginkgo" }, groups: ["bleeding_supplement"] },
  { id: "fish_oil", kind: "food", name: { vi: "Dầu cá liều cao", en: "High-dose fish oil" }, groups: ["bleeding_supplement"] },
  { id: "garlic", kind: "food", name: { vi: "Tỏi dạng viên", en: "Garlic supplement" }, groups: ["bleeding_supplement"] },
  { id: "turmeric", kind: "food", name: { vi: "Nghệ liều cao", en: "High-dose turmeric" }, groups: ["bleeding_supplement"] },
];

const r = (rule: Rule) => rule;

export const RULES: Rule[] = [
  // ---- Aspirin prophylaxis
  r({
    id: "aspirin_nsaid", level: "avoid", actor: "prescriber", evidence: "non_pregnant", all: ["aspirin", "nsaid"], phases: ANTENATAL,
    effect: { vi: "Tăng nguy cơ loét và chảy máu tiêu hoá; ibuprofen có thể giảm tác dụng chống kết tập tiểu cầu của aspirin.", en: "Higher risk of gastrointestinal ulcer and bleeding; ibuprofen can blunt aspirin's antiplatelet effect." },
    manage: { vi: "Giảm đau, hạ sốt bằng paracetamol.", en: "Use paracetamol for pain and fever." },
    sources: ["label"],
  }),
  r({
    id: "aspirin_salicylate", level: "avoid", actor: "prescriber", evidence: "mechanism", all: ["aspirin", "salicylate"],
    effect: { vi: "Trùng hoạt chất, cộng dồn liều salicylat.", en: "Duplicate active ingredient: salicylate doses add up." },
    manage: { vi: "Chọn sản phẩm không chứa salicylat.", en: "Choose a salicylate-free product." },
    sources: ["label"],
  }),
  r({
    id: "aspirin_anticoag", level: "caution", actor: "prescriber", evidence: "non_pregnant", all: ["aspirin", "anticoagulant"],
    effect: { vi: "Tăng nguy cơ chảy máu.", en: "Higher risk of bleeding." },
    manage: { vi: "Chỉ phối hợp khi có chỉ định (ví dụ hội chứng kháng phospholipid); báo bác sĩ gây mê trước gây tê tủy sống/ngoài màng cứng.", en: "Combine only when indicated (e.g. antiphospholipid syndrome); tell the anaesthetist before spinal/epidural anaesthesia." },
    sources: ["label"],
  }),
  r({
    id: "aspirin_ssri", level: "caution", actor: "prescriber", evidence: "non_pregnant", all: ["aspirin", "ssri"],
    effect: { vi: "Tăng nguy cơ chảy máu, nhất là tiêu hoá.", en: "Higher risk of bleeding, especially gastrointestinal." },
    manage: { vi: "Không tự ngưng thuốc chống trầm cảm; theo dõi dấu hiệu chảy máu.", en: "Do not stop the antidepressant unadvised; watch for bleeding." },
    sources: ["label"],
  }),
  r({
    id: "aspirin_steroid", level: "caution", actor: "prescriber", evidence: "non_pregnant", all: ["aspirin", "steroid_long"],
    effect: { vi: "Tăng nguy cơ loét tiêu hoá.", en: "Higher risk of gastrointestinal ulcer." },
    manage: { vi: "Theo dõi triệu chứng dạ dày; cân nhắc thuốc bảo vệ dạ dày.", en: "Watch for stomach symptoms; consider gastric protection." },
    sources: ["label"],
  }),
  r({
    id: "aspirin_supplement", level: "caution", actor: "prescriber", evidence: "mechanism", all: ["aspirin", "bleeding_supplement"],
    effect: { vi: "Có thể tăng nguy cơ chảy máu (bằng chứng hạn chế).", en: "May increase bleeding (limited evidence)." },
    manage: { vi: "Ghi lại và hỏi lý do dùng; cân nhắc ngưng thực phẩm chức năng.", en: "Record it and ask why it is taken; consider stopping the supplement." },
    sources: ["label"],
  }),
  r({
    id: "aspirin_coagulopathy", level: "avoid", actor: "prescriber", evidence: "pregnancy_trial", all: ["aspirin"], flags: ["coagulopathy"],
    effect: { vi: "ASPRE không nhận sản phụ rối loạn đông máu; chưa có dữ liệu an toàn.", en: "ASPRE excluded bleeding disorders; safety is unknown." },
    manage: { vi: "Bác sĩ sản và huyết học quyết định riêng.", en: "Obstetrician and haematologist decide case by case." },
    sources: ["aspre"],
  }),
  r({
    id: "aspirin_stop36", level: "caution", actor: "prescriber", evidence: "pregnancy_trial", all: ["aspirin"], phases: ["ge36"],
    effect: { vi: "ASPRE dùng aspirin đến 36 tuần; tiếp tục sau đó không có lợi đã chứng minh.", en: "ASPRE gave aspirin until 36 weeks; no proven benefit after that." },
    manage: { vi: "Ngưng ở 36 tuần, trước sinh và gây tê trục thần kinh.", en: "Stop at 36 weeks, before delivery and neuraxial anaesthesia." },
    sources: ["aspre"],
  }),
  r({
    id: "aspirin_neuraxial", level: "caution", actor: "anaesthetist", evidence: "guideline", all: ["aspirin"], flags: ["neuraxial"],
    effect: { vi: "Sản phụ đang dùng thuốc chống kết tập tiểu cầu trước gây tê trục thần kinh.", en: "Antiplatelet on board before neuraxial anaesthesia." },
    manage: { vi: "Báo bác sĩ gây mê thời điểm liều cuối và các thuốc chống đông khác.", en: "Tell the anaesthetist the time of the last dose and any anticoagulant." },
    sources: ["label"],
  }),
  r({
    id: "aspirin_adherence", level: "info", actor: "prescriber", evidence: "pregnancy_trial", all: ["aspirin"], phases: ["lt20", "w20to36"],
    effect: { vi: "Hiệu quả phụ thuộc tuân thủ: RR 0,25 khi uống đủ, 0,70 khi chỉ uống 50% số liều.", en: "Benefit depends on adherence: RR 0.25 with every dose, 0.70 with half the doses." },
    manage: { vi: "Dặn uống mỗi tối và hỏi lại số liều đã quên ở mỗi lần khám.", en: "Advise a nightly dose and ask about missed doses at every visit." },
    sources: ["adherence", "aspre"],
  }),
  // ---- NSAIDs alone
  r({
    id: "nsaid_antenatal", level: "avoid", actor: "prescriber", evidence: "guideline", all: ["nsaid"], phases: ["w20to36", "ge36"],
    effect: { vi: "Từ 20 tuần, NSAID có thể gây thiểu ối do ảnh hưởng thận thai.", en: "From 20 weeks NSAIDs can cause oligohydramnios through fetal kidney effects." },
    manage: { vi: "Dùng paracetamol.", en: "Use paracetamol." },
    sources: ["fda_nsaid"],
  }),
  r({
    id: "nsaid_postpartum", level: "info", actor: "prescriber", evidence: "pregnancy_trial", all: ["nsaid"], phases: ["postpartum"],
    effect: { vi: "3 thử nghiệm ngẫu nhiên: ibuprofen sau sinh không làm tăng huyết áp nặng ở sản phụ tăng huyết áp thai kỳ.", en: "Three RCTs: postpartum ibuprofen did not worsen severe hypertension in hypertensive disorders of pregnancy." },
    manage: { vi: "Dùng được; theo dõi huyết áp như thường quy.", en: "Acceptable; monitor blood pressure as usual." },
    sources: ["nsaid_pp"],
  }),
  // ---- Antihypertensives
  r({
    id: "acei_pregnancy", level: "avoid", actor: "prescriber", evidence: "guideline", all: ["acei_arb"], phases: ANTENATAL,
    effect: { vi: "Gây hại cho thai (thận thai, thiểu ối) ở quý 2 và 3.", en: "Fetotoxic (fetal kidney, oligohydramnios) in the second and third trimesters." },
    manage: { vi: "Chuyển sang labetalol, nifedipin hoặc methyldopa.", en: "Switch to labetalol, nifedipine or methyldopa." },
    sources: ["isshp"],
  }),
  r({
    id: "beta_asthma", level: "avoid", actor: "prescriber", evidence: "guideline", all: ["beta_blocker"], flags: ["asthma"],
    effect: { vi: "Chẹn beta có thể gây co thắt phế quản ở người hen.", en: "Beta-blockers can trigger bronchospasm in asthma." },
    manage: { vi: "Dùng nifedipin hoặc hydralazin.", en: "Use nifedipine or hydralazine." },
    sources: ["label", "isshp"],
  }),
  r({
    id: "beta_insulin", level: "caution", actor: "nurse", evidence: "non_pregnant", all: ["beta_blocker", "hypoglycaemic"],
    effect: { vi: "Chẹn beta che lấp dấu hiệu hạ đường huyết (run, tim nhanh).", en: "Beta-blockade masks hypoglycaemia (tremor, fast heart rate)." },
    manage: { vi: "Theo dõi đường huyết sát hơn.", en: "Monitor blood glucose more closely." },
    sources: ["label"],
  }),
  r({
    id: "severe_htn_60min", level: "info", actor: "nurse", evidence: "guideline", all: [], flags: ["severe_htn"],
    effect: { vi: "Huyết áp ≥160/110 mmHg kéo dài 15 phút cần điều trị trong 60 phút; ca đêm hay bị trễ.", en: "BP ≥160/110 mmHg for 15 minutes needs treatment within 60 minutes; night shifts are often late." },
    manage: { vi: "Ghi giờ phát hiện; dùng labetalol tĩnh mạch, hydralazin tĩnh mạch hoặc nifedipin uống theo phác đồ khoa.", en: "Record the time found; give IV labetalol, IV hydralazine or oral nifedipine per department protocol." },
    sources: ["delay", "isshp"],
  }),
  // ---- Magnesium sulphate
  r({
    id: "mg_monitoring", level: "info", actor: "nurse", evidence: "guideline", all: ["magnesium"],
    effect: { vi: "Thuốc nguy cơ cao: quá liều do pha, cài bơm sai vẫn xảy ra; bơm thông minh không loại hết sai sót.", en: "High-alert drug: overdose from mixing or pump errors still happens; smart pumps do not remove every error." },
    manage: { vi: "Hai người kiểm tra độc lập khi pha và cài bơm; theo dõi phản xạ gân xương, nhịp thở, nước tiểu; sẵn calci gluconat.", en: "Independent double check of mixing and pump; monitor tendon reflexes, breathing and urine output; keep calcium gluconate ready." },
    sources: ["mg_errors", "pumps"],
  }),
  r({
    id: "mg_oliguria", level: "avoid", actor: "nurse", evidence: "mechanism", all: ["magnesium"], flags: ["oliguria"],
    effect: { vi: "Magie thải qua thận: thiểu niệu hoặc suy thận làm magie tích luỹ, nguy cơ ngừng thở.", en: "Magnesium is cleared by the kidney: oliguria or renal impairment lets it accumulate, risking respiratory arrest." },
    manage: { vi: "Báo bác sĩ trước khi tiếp tục liều duy trì; xét nghiệm nồng độ magie theo phác đồ.", en: "Call the doctor before continuing the maintenance dose; check serum magnesium per protocol." },
    sources: ["mgso4", "label"],
  }),
  r({
    id: "mg_ccb", level: "caution", actor: "nurse", evidence: "non_pregnant", all: ["magnesium", "ccb"],
    effect: { vi: "Cộng hợp hạ huyết áp; hiếm gặp yếu cơ do ức chế thần kinh cơ.", en: "Additive blood-pressure lowering; rarely muscle weakness from neuromuscular blockade." },
    manage: { vi: "Dùng được cùng nhau; theo dõi huyết áp, phản xạ, nhịp thở.", en: "Can be given together; monitor blood pressure, reflexes and breathing." },
    sources: ["mgso4"],
  }),
  r({
    id: "mg_aminoglycoside", level: "caution", actor: "nurse", evidence: "non_pregnant", all: ["magnesium", "aminoglycoside"],
    effect: { vi: "Tăng ức chế thần kinh cơ.", en: "Stronger neuromuscular blockade." },
    manage: { vi: "Theo dõi nhịp thở sát hơn.", en: "Monitor breathing more closely." },
    sources: ["label"],
  }),
  r({
    id: "mg_nmb", level: "caution", actor: "anaesthetist", evidence: "non_pregnant", all: ["magnesium", "nmb"],
    effect: { vi: "Kéo dài tác dụng thuốc giãn cơ.", en: "Prolongs neuromuscular blockers." },
    manage: { vi: "Báo bác sĩ gây mê đang truyền magie sulfat.", en: "Tell the anaesthetist magnesium is running." },
    sources: ["mgso4", "label"],
  }),
  // ---- Food, supplements and absorption
  r({
    id: "nifedipine_grapefruit", level: "avoid", actor: "prescriber", evidence: "non_pregnant", all: ["nifedipine", "grapefruit"],
    effect: { vi: "Ức chế CYP3A4, tăng nồng độ nifedipin: tụt huyết áp, nhức đầu, phù.", en: "Inhibits CYP3A4 and raises nifedipine levels: low blood pressure, headache, oedema." },
    manage: { vi: "Tránh bưởi chùm trong thời gian dùng nifedipin.", en: "Avoid grapefruit while taking nifedipine." },
    sources: ["grapefruit"],
  }),
  r({
    id: "nifedipine_pomelo", level: "caution", actor: "prescriber", evidence: "mechanism", all: ["nifedipine", "pomelo"],
    effect: { vi: "Bưởi có chất ức chế CYP3A4 tương tự bưởi chùm; dữ liệu với nifedipin còn ít.", en: "Pomelo carries CYP3A4 inhibitors like grapefruit; data with nifedipine are sparse." },
    manage: { vi: "Hạn chế bưởi trong thời gian dùng nifedipin.", en: "Limit pomelo while taking nifedipine." },
    sources: ["grapefruit"],
  }),
  r({
    id: "methyldopa_iron", level: "separate", actor: "prescriber", evidence: "non_pregnant", all: ["methyldopa", "iron"],
    effect: { vi: "Sắt giảm hấp thu methyldopa.", en: "Iron reduces methyldopa absorption." },
    manage: { vi: "Uống cách nhau ít nhất 2 giờ.", en: "Take at least 2 hours apart." },
    sources: ["label"],
  }),
  r({
    id: "calcium_iron", level: "separate", actor: "prescriber", evidence: "guideline", all: ["calcium", "iron"],
    effect: { vi: "Canxi giảm hấp thu sắt.", en: "Calcium reduces iron absorption." },
    manage: { vi: "Uống cách nhau vài giờ.", en: "Take several hours apart." },
    sources: ["who_calcium"],
  }),
  // ---- Drugs without proven benefit for preeclampsia
  r({
    id: "pravastatin_no_benefit", level: "info", actor: "prescriber", evidence: "pregnancy_trial", all: ["pravastatin"],
    effect: { vi: "STATIN: pravastatin 20 mg/ngày từ 35–37 tuần không giảm tiền sản giật (14,6% so với 13,6%).", en: "STATIN: pravastatin 20 mg/day from 35–37 weeks did not reduce PE (14.6% vs 13.6%)." },
    manage: { vi: "Không dùng để phòng tiền sản giật ngoài nghiên cứu.", en: "Do not use to prevent PE outside research." },
    sources: ["statin"],
  }),
];

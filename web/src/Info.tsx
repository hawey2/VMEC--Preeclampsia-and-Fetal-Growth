import { t, type Lang } from "./i18n";

type Block = { title: [string, string]; items: [string, string][] };

const blocks: Block[] = [
  {
    title: ["Sàng lọc 11+0 – 13+6 tuần", "Screening at 11+0 to 13+6 weeks"],
    items: [
      [
        "Mục tiêu: xác định nhóm nguy cơ cao tiền sản giật sinh non (<37 tuần) để dự phòng bằng aspirin 150 mg/ngày từ 11–14 đến 36 tuần.",
        "Aim: identify the group at high risk of preterm PE (<37 weeks) for prophylactic aspirin 150 mg/day from 11–14 to 36 weeks.",
      ],
      [
        "Thử nghiệm ASPRE: aspirin giảm khoảng 90% tiền sản giật <32 tuần và 60% tiền sản giật sinh non; không giảm tiền sản giật đủ tháng.",
        "ASPRE trial: aspirin reduces early PE (<32 w) by about 90% and preterm PE by 60%; it does not reduce term PE.",
      ],
      [
        "Ở London, kết hợp yếu tố mẹ, UtA-PI, MAP và PlGF với ngưỡng 1/100 phát hiện 75% tiền sản giật sinh non với tỉ lệ dương tính 10%.",
        "In London, maternal factors with UtA-PI, MAP and PlGF at a 1 in 100 cut-off detect 75% of preterm PE at a 10% screen-positive rate.",
      ],
    ],
  },
  {
    title: ["Huyết áp động mạch trung bình (MAP)", "Mean arterial pressure (MAP)"],
    items: [
      ["Dùng máy đo tự động đã kiểm định, hiệu chuẩn định kỳ; không dùng huyết áp kế thuỷ ngân.", "Use validated, regularly calibrated automated devices; not mercury sphygmomanometers."],
      ["Sản phụ ngồi, không bắt chéo chân; tay đặt ngang tim.", "Woman seated, legs uncrossed, arm supported at heart level."],
      ["Chọn băng quấn theo chu vi cánh tay: nhỏ <22 cm, thường 22–32 cm, lớn 33–42 cm.", "Cuff by mid-arm circumference: small <22 cm, normal 22–32 cm, large 33–42 cm."],
      ["Nghỉ 5 phút, đo 2 lần mỗi tay đồng thời; dùng trung bình 4 lần đo.", "After 5 minutes' rest, take two measurements from each arm simultaneously; use the average of the four."],
    ],
  },
  {
    title: ["PI động mạch tử cung (UtA-PI)", "Uterine artery PI"],
    items: [
      ["Qua bụng (quý 1): mặt cắt dọc giữa tử cung, tìm ống cổ tử cung; nghiêng đầu dò, dùng Doppler màu tìm động mạch tử cung ngang lỗ trong.", "Transabdominal (1st trimester): mid-sagittal uterus, find the cervical canal; tilt the probe and use colour Doppler to find each uterine artery at the internal os."],
      ["Cổng mẫu 2 mm, góc <30°, PSV >60 cm/s để chắc là động mạch tử cung.", "Sampling gate 2 mm, angle <30°, PSV >60 cm/s to be sure it is the uterine artery."],
      ["Đo PI khi có 3 sóng giống nhau liên tiếp; ghi cả trái và phải, ứng dụng dùng trung bình.", "Measure PI when three similar consecutive waveforms are seen; record left and right; the app uses the mean."],
    ],
  },
  {
    title: ["Tỉ số PSV động mạch mắt", "Ophthalmic artery PSV ratio"],
    items: [
      ["Sản phụ nằm ngửa, đầu dò thẳng 7.5 MHz đặt nhẹ trên mi mắt nhắm; Doppler xung 3–5 sóng, góc <20°, cổng 2 mm.", "Supine; 7.5 MHz linear probe gently on the closed eyelid; pulsed Doppler of 3–5 waveforms, angle <20°, gate 2 mm."],
      ["Giảm công suất, chỉ số cơ học tối đa 0.4, mỗi mắt chỉ vài giây.", "Reduced output, mechanical index ≤0.4, a few seconds per eye."],
      ["Tỉ số = PSV đỉnh 2 / PSV đỉnh 1; dùng trung bình hai mắt.", "Ratio = second-peak PSV / first-peak PSV; use the mean of both eyes."],
    ],
  },
  {
    title: ["Xét nghiệm sinh hoá", "Biochemical markers"],
    items: [
      ["Cần thiết bị và thuốc thử đã kiểm định: DELFIA Xpress (Revvity), Kryptor (Thermo Fisher), Elecsys (Roche).", "Validated equipment and reagents: DELFIA Xpress (Revvity), Kryptor (Thermo Fisher), Elecsys (Roche)."],
      ["Mọi chỉ số được quy về MoM có hiệu chỉnh theo đặc điểm mẹ; có thể nhập MoM do phòng xét nghiệm trả.", "All markers are expressed as MoMs adjusted for maternal factors; lab-reported MoMs can be entered instead."],
    ],
  },
];

export function Info({ lang }: { lang: Lang }) {
  const i = lang === "vi" ? 0 : 1;
  return (
    <details className="card how">
      <summary><h2>{t(lang, "infoTitle")}</h2></summary>
      {blocks.map((b) => (
        <div key={b.title[1]}>
          <h3>{b.title[i]}</h3>
          <ul>{b.items.map((it) => <li key={it[1]}>{it[i]}</li>)}</ul>
        </div>
      ))}
      <p className="muted small">
        {lang === "vi" ? "Nguồn: hướng dẫn của The Fetal Medicine Foundation và các bài báo trong phần Cách tính." : "Source: The Fetal Medicine Foundation guidance and the papers cited under How it is calculated."}
      </p>
    </details>
  );
}

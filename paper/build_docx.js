const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  ImageRun, Table, TableRow, TableCell, WidthType, BorderStyle,
  ShadingType,
} = require("docx");

const FIG = (name) => path.join(__dirname, "figures", name);
const FONT = "Times New Roman";
const BODY_SIZE = 22; // 11pt half-points
const SMALL = 18; // 9pt

const SIZES = {
  "fig1_diagram.png": [1473, 412],
  "fig2_architecture.png": [3251, 1334],
  "fig_auc_comparison.png": [2149, 842],
  "fig_conformal_coverage.png": [2164, 798],
  "fig_forest_odds_ratios.png": [2246, 887],
  "screenshot_blackspots.png": [1600, 1110],
  "screenshot_live_risk.png": [1600, 920],
  "screenshot_vehicle_intel.png": [1600, 955],
  "alg1.png": [1501, 1401],
  "alg2.png": [1501, 1362],
  "eq1.png": [1594, 200],
  "eq2.png": [1594, 238],
  "eq3.png": [1594, 175],
  "eq4.png": [1688, 345],
  "eq5.png": [1688, 201],
};

function dims(name, targetWidthPx) {
  const [w, h] = SIZES[name];
  const scale = targetWidthPx / w;
  return { width: targetWidthPx, height: Math.round(h * scale) };
}

function figureImage(name, widthPx, captionNum, captionText) {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 80 },
      children: [new ImageRun({ data: fs.readFileSync(FIG(name)), transformation: dims(name, widthPx), type: "png" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({ text: `Fig. ${captionNum}.  `, bold: true, size: SMALL }),
        new TextRun({ text: captionText, size: SMALL }),
      ],
    }),
  ];
}

function equationImage(name) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 160, after: 160 },
    children: [new ImageRun({ data: fs.readFileSync(FIG(name)), transformation: dims(name, 340), type: "png" })],
  });
}

function algorithmImage(name, widthPx) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 200 },
    children: [new ImageRun({ data: fs.readFileSync(FIG(name)), transformation: dims(name, widthPx), type: "png" })],
  });
}

function P(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 160, line: 276 },
    children: Array.isArray(text) ? text : [new TextRun({ text, size: BODY_SIZE })],
  });
}

function runIn(lead, rest) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 160, line: 276 },
    children: [
      new TextRun({ text: lead + "  ", bold: true, italics: true, size: BODY_SIZE }),
      new TextRun({ text: rest, size: BODY_SIZE }),
    ],
  });
}

function H1(num, text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 360, after: 200 },
    children: [new TextRun({ text: `${num}. ${text.toUpperCase()}`, bold: true, size: 24, font: FONT })],
  });
}

function H1plain(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 360, after: 200 },
    children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 24, font: FONT })],
  });
}

function H2(letter, text) {
  return new Paragraph({
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text: `${letter}. ${text}`, bold: true, italics: true, size: BODY_SIZE, font: FONT })],
  });
}

function bullet(children) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 140, line: 276 },
    bullet: { level: 0 },
    children: Array.isArray(children) ? children : [new TextRun({ text: children, size: BODY_SIZE })],
  });
}

const b = (t) => new TextRun({ text: t, bold: true, size: BODY_SIZE });
const i = (t) => new TextRun({ text: t, italics: true, size: BODY_SIZE });
const r = (t) => new TextRun({ text: t, size: BODY_SIZE });
const sup = (t) => new TextRun({ text: t, size: BODY_SIZE, superScript: true });

function cell(text, opts = {}) {
  return new TableCell({
    width: { size: opts.width || 2000, type: WidthType.DXA },
    shading: opts.header ? { type: ShadingType.CLEAR, fill: "D9D9D9" } : undefined,
    margins: { top: 80, bottom: 80, left: 80, right: 80 },
    children: [new Paragraph({
      alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [new TextRun({ text, bold: !!opts.header, size: opts.size || 17, font: FONT })],
    })],
  });
}

function makeTable(widths, rows) {
  return new Table({
    width: { size: widths.reduce((a, c) => a + c, 0), type: WidthType.DXA },
    columnWidths: widths,
    rows: rows.map((row, ri) => new TableRow({
      children: row.map((txt, ci) => cell(txt, { width: widths[ci], header: ri === 0, center: ri === 0 })),
    })),
  });
}

function tableCaption(num, text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 240, after: 40 },
    children: [new TextRun({ text: `TABLE ${num}`, bold: true, size: SMALL })],
  });
}
function tableSubCaption(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 160 },
    children: [new TextRun({ text, size: SMALL })],
  });
}

// =================================================================
// FRONT MATTER
// =================================================================
const front = [
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: [new TextRun({ text: "Smart Road Guardian AI X: VRU-First, Observability-Aware Risk Fusion for Indian Roads", bold: true, size: 36, font: FONT })],
  }),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [4680, 4680],
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 4680, type: WidthType.DXA },
            children: [
              "Aditya Ayushman Sahoo",
              "Department of Computational Intelligence,",
              "School of Computing,",
              " ",
              "SRM Institute of Science and Technology,",
              "Kattankulathur – 603203",
              "adityaasahoo@gmail.com",
            ].map((t) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20 }, children: [new TextRun({ text: t, size: 20, font: FONT })] })),
          }),
          new TableCell({
            width: { size: 4680, type: WidthType.DXA },
            children: [
              "Sageengrana S",
              "Department of Computational Intelligence,",
              "School of Computing,",
              "Faculty of Engineering and Technology,",
              "SRM Institute of Science and Technology,",
              "Kattankulathur – 603203",
              "sageengranadhas@gmail.com",
            ].map((t) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20 }, children: [new TextRun({ text: t, size: 20, font: FONT })] })),
          }),
        ],
      }),
    ],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 300 },
    children: [new TextRun({
      text: "Code, a live demonstration system, and every result in this paper are open at github.com/adityaayushman/TRIE and trie-dashboard.vercel.app.",
      italics: true, size: 18, font: FONT,
    })],
  }),
  new Paragraph({
    spacing: { after: 160, line: 276 },
    alignment: AlignmentType.JUSTIFIED,
    children: [
      b("Abstract—"),
      r("Most road-safety technology assumes crashes must accumulate before a location is flagged, risk belongs to the occupant, and a single score is honest regardless of which sensors fired. None of this holds in India, where 66.8% of the roughly 1.7 lakh people killed each year are vulnerable road users (VRUs) with no metal around them. We present a system built on the opposite assumptions. An observability-aware fusion model scores only measurable factors, redistributing the rest, with a conformal coverage guarantee tied to sensor availability. A VRU-first weighting, extended by a fine-tuned helmet and triple-riding detector, turns rider vulnerability into a per-rider multiplier rather than a footnote. A predictive black-spot engine nominates dangerous stretches from near-misses before a crash record exists. Because no public dataset pairs Indian telemetry with crash outcomes, we validate the model's premise on 128,269 UK STATS19 casualties: the model's factors predict fatal outcomes with an ROC-AUC of 0.725 (95% CI 0.713–0.737), every factor points in the expected direction, and a likelihood-ratio test confirms a significant speed-by-VRU interaction (p<10"),
      sup("−9"),
      r(" ). Descriptively, on 2,898 real Indian fatal crashes, VRUs are 56% of victims and 69.5% were killed by a heavier vehicle. Inferentially, on 4,058 distinct NHAI highway crashes, VRU involvement carries an adjusted odds ratio of 1.97 (95% CI 1.73–2.26) for a killed-or-seriously-injured outcome. We also report a negative result: lower-severity crashes do not anticipate the severe ones our black-spot engine targets, once crash volume is controlled for. Limitations are stated as prominently as favourable results: black-spot discovery evaluation is a controlled simulation, and the Indian inferential model is scoped to national highways. All code, data-provenance notes, and evaluation scripts are open."),
    ],
  }),
  new Paragraph({
    spacing: { after: 300, line: 276 },
    alignment: AlignmentType.JUSTIFIED,
    children: [
      b("Index Terms—"),
      r("conformal prediction, explainable artificial intelligence, India, risk fusion, road safety, surrogate safety measures, vulnerable road users."),
    ],
  }),
];

// =================================================================
// I. INTRODUCTION
// =================================================================
const introduction = [
  H1(1, "Introduction"),
  P("India recorded roughly 1.68 lakh road deaths in 2022 and 1.77 lakh in 2024, by the Ministry of Road Transport and Highways' own count [1]. Two-wheeler riders account for 46.2% of that toll and pedestrians for another 20.6%, so two of every three people who die on an Indian road are a vulnerable road user, not an occupant. Yet the safety paradigms in wide use were developed somewhere else, under three assumptions that do not hold here."),
  P("The first is that safety work can be reactive. India's own black-spot programme, iRAD/e-DAR, only flags a roughly 500 m stretch of road after it has produced five fatal or grievous crashes, or ten deaths, within three years [1]. A location has to kill people before the system will name it."),
  P("The second is that risk belongs to the occupant. Advanced driver-assistance and collision-warning systems model time-to-collision and driver state for the person inside the vehicle. They were not built to ask how dangerous that vehicle is to the people walking or riding beside it, which on an Indian road is usually the more urgent question."),
  P('The third is that a single number is an honest number. Most risk scores report one figure with no sense of how much of the scene the system could actually see. A missing lane-departure signal is typically read as "in lane" rather than "unknown," and the reported confidence does not change whether every sensor fired or only one did.'),
  H2("A", "Contributions"),
  P("This paper inverts each of those three assumptions; more importantly, it tests whether the resulting design actually holds up against real crash data rather than only against its own simulations."),
  bullet([b("An observability-aware risk fusion with a conformal coverage guarantee. "), r('The model is a transparent additive sum that scores only the factors it can observe and redistributes the weight of anything it cannot. Its uncertainty is not a heuristic band but a class-conditional, observability-conditional split conformal guarantee: in every sensor regime we test, at least 1−α of truly fatal outcomes are guaranteed, distribution-free, to fall inside the model’s "cannot rule out fatal" set, and the alarm-rate cost of that guarantee grows exactly as sensors drop. This is the paper’s primary contribution, and the one we validate most heavily on real data (Section IV-B).')]),
  bullet([b("VRU-first weighting with per-rider vulnerability. "), r("Vulnerable road users are a first-class, exposure-weighted factor rather than an afterthought, and a fine-tuned detector reads whether a rider is helmeted, bare-headed, or riding three-up, turning that into a WHO-grounded severity multiplier.")]),
  bullet([b("Predictive black-spot discovery. "), r("The same 500 m unit iRAD uses is instead nominated from near-misses, exposure-normalised and ranked by a Wilson lower bound, so a stretch can be flagged days or weeks before it produces a crash record. We treat this as a secondary contribution, because our own controlled evaluation of it (Section IV-D) is a simulation, and we say so plainly.")]),
  bullet([b("A reproducible, honesty-first evaluation. "), r("Every claim in this paper, including the ones that did not pan out, is one command away in the open repository, and the limitations are written with the same weight as the results.")]),
  P("Predicting hazard from near-misses is not itself a new idea; Section II places this work against the surrogate-safety-measures literature that originated it. What we believe is new is the system design: fusing heterogeneous, partially observed factors into a single score that is honest about its own uncertainty, weighted toward the people who actually die on Indian roads, and then shown, not merely asserted, to rest on factor relationships that hold in real crash records."),
];

// =================================================================
// II. RELATED WORK
// =================================================================
const relatedWorkRows = [
  ["Prior Area", "Representative Work", "What It Does", "What This Paper Adds"],
  ["Surrogate safety measures / traffic conflict techniques", "SSAM [2]; time-to-collision and post-encroachment-time indicators; a VRU surrogate-indicator review [3]", "Use near-misses as proactive precursors to crashes, increasingly for vulnerable road users", "Folds surrogate exposure into a multi-factor, explainable fusion with sensor-aware uncertainty instead of a single conflict indicator, and uses it for segment nomination rather than point-level conflict counting"],
  ["Hotspot / black-spot identification", "Empirical Bayes methods [4]; the AASHTO Highway Safety Manual [5]; a comparative evaluation of identification methods [6]", "Combine a safety performance function with observed crash counts, using Bayesian shrinkage to correct regression-to-the-mean", "Empirical Bayes still needs crash history to run; this system nominates from near-misses with a Wilson lower bound, before crashes accrue, so the two approaches are complementary rather than competing"],
  ["Explainable machine learning for crash severity", "Post-hoc attribution over ensemble severity models, e.g. XGBoost with SHAP on fatal pedestrian crashes [7]", "Explain a black-box severity classifier after the fact", "The shipped model is exactly additive by construction, so its explanation is the decomposition itself; calibrated uncertainty tied to observability is also added, which post-hoc attribution does not provide"],
  ["VRU and helmet safety", "WHO's estimated 42% helmet fatality reduction [8]; helmet-detection computer vision", "Detect or enforce helmet use, and quantify its benefit in aggregate", "Converts per-rider detection directly into a scene vulnerability multiplier that is wired into the live risk score, not reported separately"],
  ["Uncertainty quantification", "Bayesian and ensemble uncertainty; conformal prediction", "Produce predictive uncertainty, in some cases with distribution-free coverage guarantees", "Applies class-conditional, observability-conditional split conformal prediction: a guarantee tied specifically to which sensors were available, which is the deployment-relevant question"],
];

const relatedWork = [
  H1(2, "Related Work and Positioning"),
  P("Table I summarises the literatures this work draws on and what it adds to each."),
  tableCaption("I", ""),
  tableSubCaption("Positioning against prior work"),
  makeTable([1500, 1900, 2300, 2900], relatedWorkRows),
  P(" "),
  P("No prior system we are aware of combines observability-aware fusion that never silently scores a missing factor as safe, a calibrated uncertainty band tied to sensor coverage, VRU-first weighting extended to individual rider vulnerability, and predictive segment nomination, and then checks whether the premise behind that combination holds on real crash records. Near-miss-based prediction is well established on its own; the claim here is the combination of fusion design, stated honesty about uncertainty, and VRU-first weighting, not near-miss prediction in isolation."),
];

// =================================================================
// III. SYSTEM AND METHOD
// =================================================================
const systemMethod = [
  H1(3, "System and Method"),
  P("Fig. 1 shows the data flow the rest of this section describes in detail: per-factor magnitudes are extracted from whatever sensors are present, the fusion step drops and renormalises around anything missing rather than guessing it, and the reported score always carries the calibrated band alongside it."),
  ...figureImage("fig1_diagram.png", 420, 1, "Data flow through the risk-fusion engine. A missing sensor drops its factor instead of scoring it as safe; the fusion step renormalises the remaining weights, and the reported band’s width is exactly the unobserved weight mass."),
  H2("A", "Observability-aware risk fusion"),
  P("Given the available driver, vehicle, road, traffic, perception, and environmental state, the engine computes a magnitude in [0,1] for each factor and fuses them as a weighted sum. The base weights are ordered by each factor’s share of Indian road deaths rather than by how easy it is to measure: driver distraction 0.28, speed 0.22, VRU exposure 0.20, road quality 0.13, lane drift 0.09, and traffic congestion 0.08, with a seventh, low-light environmental factor weighted at 0.10 and folded in so that the six perception factors keep their exact relative weights whenever it is absent."),
  P('Two design choices do the actual work here. First, a factor with no sensor behind it — no cabin camera, so no distraction signal; no lane markings, so no lane-drift signal — is dropped and its weight is renormalised across the factors that are observed, rather than silently scored as zero, which would read as "safe." This keeps the output a genuine 0–100 score that stays comparable across sensor suites and across the very different road types a vehicle might be on. Second, the point score alone assumes an unmeasured factor behaves like the average of what was measured; a calibrated band makes that assumption explicit, with its lower bound assuming every unmeasured factor is benign and its upper bound assuming the worst, so the band’s width is exactly the unobserved weight. A fully instrumented vehicle collapses the band to a point; a speed-only deployment produces roughly a 30-point band (for example, a 28% point score becomes a 17–54% band), an honest admission that the system cannot see enough to be more precise.'),
  P("Because the fusion is additive, the contributing-factor breakdown the system reports is exactly the decomposition of the score, not a post-hoc approximation of one."),
  runIn("Formal statement.", "Let F = {1, …, 7} index the factors above with fixed base weights wᵢ and total W_F = Σ wᵢ (the seven published weights are rounded to two significant figures and need not sum to exactly 1; the renormalisation below is defined so that this never matters). Let O ⊆ F be the subset actually observed on a given deployment, with observed weight mass W_O = Σ_{i∈O} wᵢ and unobserved weight mass W_U = W_F − W_O. Writing xᵢ ∈ [0,1] for the magnitude the engine extracts for factor i, the reported point score on a 0–100 scale is the weighted average over only the observed factors, Eq. (1):"),
  equationImage("eq1.png"),
  P("which reduces to the full seven-factor weighted average whenever O = F, and is exactly what results from imputing every unobserved factor with the weighted average of the observed ones. The calibrated band around R instead normalises by the fixed total W_F and does not impute: the lower bound scores every unobserved factor as benign (xᵢ = 0) and the upper bound scores every unobserved factor at its worst (xᵢ = 1), Eq. (2):"),
  equationImage("eq2.png"),
  P("so that the band width R_hi − R_lo = 100 W_U/W_F is, by construction, exactly the unobserved share of the total weight mass, R always falls inside [R_lo, R_hi], and the band collapses to the single point R_lo = R = R_hi once every sensor is present. Algorithm 1 gives the procedure that computes (R, R_lo, R_hi) from whichever sensors happen to be live."),
  algorithmImage("alg1.png", 440),
  H2("B", "VRU-first weighting and per-rider vulnerability"),
  P('Two-wheelers and pedestrians are kept as distinct perception classes throughout the pipeline and weighted for exposure, meaning proximity combined with crowding, rather than folded into a generic "other road user" bucket. A fine-tuned YOLOv11 detector further classifies each rider as helmeted, bare-headed, or riding three-up; those counts become a scene-level vulnerability multiplier. Using WHO’s estimate that a helmet cuts fatality risk by roughly 42% [8], a bare head is treated as 1/(1−0.42) ≈ 1.72× the risk, triple-riding adds a bounded aggravating factor of about 1.4×, and the product of the two is capped at 1.85× so no single scene can dominate the score. Formally, with b, t ∈ {0,1} indicating whether the scene contains at least one bare-headed rider or one triple-riding instance, Eq. (3):'),
  equationImage("eq3.png"),
  P("and this multiplier amplifies the VRU-exposure magnitude before weighting, so the score stays additive and the reason it moved stays legible."),
  H2("C", "Predictive black-spot discovery"),
  P("The same 500 m unit iRAD uses is instead nominated from near-misses: every vehicle pass through a cell is the exposure denominator, and cells are ranked by a Wilson score lower bound rather than a raw near-miss rate, so a stretch can be flagged before anyone is hurt there, and a cell with one near-miss out of one pass cannot outrank a well-attested one. Formally, for a cell with k near-misses out of n vehicle passes, writing p̂ = k/n and z = z_(1−α/2) for the standard normal quantile, Eq. (4):"),
  equationImage("eq4.png"),
  P("and cells are ranked in descending order of WLB(k,n) rather than p̂ itself, which is what suppresses a single unlucky pass at a low-traffic cell. Algorithm 2 summarises the nomination procedure end to end."),
  algorithmImage("alg2.png", 440),
  H2("D", "Environmental context and temporal forecast"),
  P("A time-of-day lighting-risk factor is grounded in MoRTH’s own published crash-timing data, under which the 18:00–21:00 window holds 20.4% of all accidents, the single highest three-hour band on record [1]; because it reads from the clock rather than a camera, it is available on every deployment regardless of hardware. A self-supervised temporal model separately extrapolates each vehicle’s own risk trend over time."),
  H2("E", "End-to-end system architecture"),
  P("Fig. 2 expands Fig. 1 into the complete pipeline described in this section: three sensor streams feed four perception and estimation models; their outputs become the seven per-factor magnitudes of Eq. (1) and the VRU multiplier of Eq. (3); the fusion engine of Algorithm 1 combines them under whichever sensor mask is live; and the resulting score and band drive four downstream consumers, one of which, black-spot nomination, is Algorithm 2 running continuously over the fused engine’s own high-risk events. The operator dashboard at the bottom is the same interface captured in Figs. 3, 7, and 8."),
  ...figureImage("fig2_architecture.png", 624, 2, "End-to-end architecture. Raw sensor streams (I) are turned by learned perception and estimation models (II) into per-factor magnitudes and the VRU multiplier (III); the core fusion engine (IV, shaded darker to mark it as the centrepiece) renormalises around whichever sensors are live (Algorithm 1) and hands its score to four consumers (V), one of which, black-spot nomination, continuously re-runs Algorithm 2 over the engine’s own high-risk events; all four surface in the operator dashboard (VI). Shading intensity increases with each block’s centrality to the pipeline; dashed boundaries mark the two sub-modules referenced individually in the text."),
];

// =================================================================
// IV. EXPERIMENTS AND RESULTS
// =================================================================
const datasetRows = [
  ["Dataset", "Role", "Scale", "Geography", "License"],
  ["DfT STATS19 [9]", "External validation of the factor structure", "128,269 casualty records, 2024", "Great Britain", "UK Open Government Licence"],
  ["NHAI highway accident data [10]", "Indian inferential severity model", "4,058 distinct crashes, de-duplicated from 8,116 released rows, 2013–2018 & 2022–2023", "India, 4 NHAI highway segments", "CC-BY-4.0"],
  ["Media-reported fatal crashes [11]", "Indian descriptive corroboration", "2,898 fatal crashes, 2022–2023", "India, national", "CC BY"],
  ["RDD2022, Indian split [12]", "Road-damage detector fine-tuning", "1,542 held-out validation images", "India", "Research use"],
  ["Traffic-violation imagery (Kaggle)", "Helmet / triple-riding detector fine-tuning", "11,195 training images", "India", "Open, attribution"],
  ["India Driving Dataset (IDD)", "Perception fine-tune, not yet in production", "15 road-user classes", "India", "Non-commercial research"],
  ["MoRTH Road Accidents in India [1]", "Reference statistics only; not used to fit any model", "National annual aggregates, 2021–2024", "India", "Government report"],
];

const damageRows = [
  ["Class", "mAP@50", "mAP@50–95"],
  ["Alligator crack", "57.7%", "27.3%"],
  ["Pothole", "44.3%", "16.5%"],
  ["Longitudinal crack", "28.0%", "12.5%"],
  ["Transverse crack", "1.9%", "0.4%"],
  ["Overall", "33.0%", "14.2%"],
];

const results = [
  H1(4, "Experiments and Results"),
  P("Fig. 3 shows the deployed Live Risk view described architecturally in Section III-E: the fused score and band, the contributing-factor decomposition of Eq. (1), the causal chain, and the temporal-forecast panel, all on one screen of the open demonstration system at trie-dashboard.vercel.app."),
  ...figureImage("screenshot_live_risk.png", 480, 3, "The deployed Live Risk dashboard: the fused score and band (left), and the additive contributing-factor breakdown, causal chain, and temporal-forecast panel it decomposes into (right), matching Eq. (1) exactly rather than approximating it."),
  H2("A", "Datasets"),
  P("Table II summarises every dataset used in this paper: one large real-crash source used to validate the factor structure externally, two independent real Indian crash sources used to corroborate it, two Indian imagery sets used to fine-tune the two detectors actually shipped, one Indian imagery set earmarked for a perception fine-tune still in progress (Section VI), and the government aggregate statistics used for context and cross-checking rather than for fitting any model. One further candidate dataset, a Kaggle release claiming to be Indian road-accident records, was inspected and rejected before use: its road-alignment, location, and vehicle-category fields matched the published Addis Ababa, Ethiopia accident dataset exactly, down to row and column counts, under an incorrect geographic label. We record the rejection rather than silently omitting the dataset, since the check itself is part of the methodology this paper asks a reader to trust."),
  tableCaption("II", ""),
  tableSubCaption("Datasets used in this work"),
  makeTable([2400, 2300, 2500, 1700, 1700], datasetRows),
  P(" "),
  H2("B", "External validation of the premise on real crashes"),
  runIn("1) Data:", "We use the UK Department for Transport’s STATS19 database for 2024 [9]: 100,928 police-reported injury collisions and 128,272 casualties, merged to 128,269 casualty records carrying speed limit, light condition, road-surface condition, and casualty type (vulnerable road user versus vehicle occupant), together with a fatal or non-fatal outcome."),
  runIn("2) Multivariable logistic regression:", "With all four factors mutually adjusted, a vulnerable road user carries an odds ratio of 3.66 (95% CI 3.27–4.09, p<10⁻¹¹⁵) for a fatal outcome; speed limit, per standard deviation, carries 2.23 (2.12–2.34, p<10⁻²²⁹); darkness carries 1.73 (1.56–1.92, p<10⁻²⁴); and poor road surface is essentially null, at 1.02 (0.92–1.15, p=0.67)."),
  runIn("3) Interactions:", "A likelihood-ratio test (χ²=39.2, df=2, p=3×10⁻⁹) shows the speed-by-VRU interaction is significant (OR 1.34, p<10⁻⁹): VRU risk compounds with speed, exactly as the VRU-first design predicts. The speed-by-darkness interaction is not significant (p=0.21). We note this partly because an earlier raw-rate chart of ours had suggested a widening dark-driving penalty at speed; the formal test demoted that impression, and we rely on the test rather than the chart."),
  runIn("4) Discrimination and calibration:", "Five-fold cross-validated ROC-AUC is 0.725 (95% CI 0.713–0.737); a gradient-boosted baseline reaches only 0.733, so the four factors already carry nearly all the signal a more flexible model can extract. The model is well calibrated, with a Brier score of 0.0121 and an expected calibration error of 0.18%. A leave-one-out ablation shows dropping speed costs the most discrimination (ΔAUC −0.13) and dropping poor surface costs essentially nothing (−0.00), consistent with its null odds ratio."),
  runIn("5) Conformal coverage guarantee:", "We replace the heuristic uncertainty band with class-conditional, by-label split conformal prediction at α=0.1, fitted separately for each sensor regime on a three-way split of the 128k casualties. Formally, for a calibration set held out within a given sensor regime and class y ∈ {fatal, non-fatal}, let s(x,y) = 1 − f̂(x)_y be the nonconformity score of the fitted model f̂ and let q̂_y be the appropriate empirical quantile of the calibration nonconformity scores for class y. The prediction set, Eq. (5):"),
  equationImage("eq5.png"),
  P('then satisfies the distribution-free, class-conditional guarantee Pr(y ∈ C(x)) ≥ 1−α for each class y, so "cannot rule out fatal" is precisely fatal ∈ C(x). The resulting guarantee, that at least 90% of truly fatal outcomes fall inside the model’s "cannot rule out fatal" set, is a guarantee on coverage in expectation over the calibration draw. It is met empirically in every regime on the split we report: 92.8% with the full sensor suite, 96.5% with the camera removed, and 94.8% telemetry-only. Because the fatal class is rare, a single split’s empirical coverage carries real sampling noise, roughly ±2 points on about 300 fatal test cases; an independent re-run of the identical code landed at 89.5%, 95.5%, and 93.0% on those same three regimes. A value a point or two under the 90% target on any one split is therefore consistent with the guarantee rather than a violation of it, and our own automated check accordingly asserts coverage within about two standard errors of target rather than a hard inequality. The cost of the guarantee is the alarm rate, and it is exactly the observability thesis made rigorous: with the full sensor suite the model can confidently clear 32% of cases of any fatal risk at all, against only 12–17% once the camera is removed, the same guaranteed fatal recall at a quantified price for fewer sensors, where the model previously shipped only a heuristic band. Fig. 4 plots both runs’ empirical coverage against the 90% target and the corresponding alarm-rate cost side by side.'),
  ...figureImage("fig_conformal_coverage.png", 500, 4, "Class-conditional split-conformal coverage of the fatal class across sensor regimes, for the reported run and an independent replication (a), against the cost of the guarantee in cases the model can confidently clear of fatal risk (b). Coverage tracks the 90% target in every regime within sampling noise, and the alarm-rate cost falls sharply once the camera is lost, which is the observability thesis made quantitative."),
  runIn("6) Interpretation and scope:", "This experiment validates the factor structure the model rests on — the right factors, in the right direction, in the right order of importance — on real crash records. It is British, not Indian, data: the two VRU classes that dominate Indian deaths, pedestrians and motorcyclists, are exactly the high-fatality classes here too, but Britain’s comparatively well-protected cyclists score low, which is an honest cross-domain difference rather than something to paper over. Crash severity is also not identical to the live risk score the system reports day to day."),
  runIn("7) Indian corroboration:", "The British-data caveat above is answered directly with real Indian crashes: 2,898 fatal crashes reported nationally in 2022–2023, extracted by natural-language processing from Times of India coverage [11]. Vulnerable road users are 56.2% of the fatal-crash victims in this sample (38.8% two-wheeler riders, 16.0% pedestrians, 1.3% cyclists), consistent in direction with MoRTH’s own 66.8% figure, and 69.5% of VRU victims were killed by a heavier road user, which is direct support for the exposure argument the VRU-first weighting is built on. Because this is a media-reported, fatal-only sample, it corroborates the premise descriptively rather than re-fitting the severity model."),
  runIn("8) Indian inferential model:", "To remove the fatal-only limitation, we use a second Indian source that does carry non-fatal crashes: 4,058 distinct record-level crashes from National Highways Authority of India highway segments, dated 2013–2018 and 2022–2023, with no records for 2019–2021 [10], decoded with the authors’ own published codebook. The released file lists every crash twice, 8,116 rows for those 4,058 crashes, with 4,054 of the 4,058 rows identical across the two halves; we detect and remove the duplicate, since treating it as independent would narrow the confidence intervals by roughly √2 and leak duplicate rows across cross-validation folds. A multivariable logistic regression on a killed-or-seriously-injured outcome, the direct Indian counterpart to the STATS19 model above, supports the same factor structure: VRU involvement carries an odds ratio of 1.97 (95% CI 1.73–2.26, p≈3×10⁻²³); a VRU struck by a heavier vehicle carries 1.48 (1.07–2.05, p=0.018); overspeeding carries 1.23 (1.09–1.40, p=0.001); and night-time carries 1.25 (1.10–1.42, p<10⁻³). A crash involving a vulnerable road user very nearly doubles the adjusted odds of a severe outcome, and dropping VRU involvement from the model costs more discrimination than dropping any other factor. Discrimination here is modest, and we report it as such: cross-validated AUC is 0.58 (95% CI 0.56–0.60), no better than a gradient-boosted baseline at 0.57. We also report, in full, that sharp curves come out protective (odds ratio 0.46, p=0.004), a known highway-exposure and behavioural-compensation artefact, while the undivided-road (0.84) and adverse-weather (0.88) terms point the same way but are not statistically significant (p≈0.09). The scope of this result is NHAI national highways specifically, a high-speed inter-urban profile rather than urban Indian roads generally; the outcome is injury severity, not the live risk score; and night-time is an 18:00–06:00 proxy, since the data carries no measured light-condition field."),
  P("Fig. 5 summarises both multivariable models as forest plots of adjusted odds ratios: the VRU-related terms sit well clear of unity with tight confidence intervals in both the British and the Indian model, while the factors that do not survive adjustment, poor road surface in STATS19 and the sharp-curve, undivided-road, and weather terms in NHAI, are shown with the same visual weight rather than quietly omitted."),
  ...figureImage("fig_forest_odds_ratios.png", 500, 5, "Adjusted odds ratios (95% CI, log scale) for a fatal outcome in STATS19 (a) and a killed-or-seriously-injured outcome on NHAI highways (b). Grey whiskers cross the line of no effect (OR = 1); navy whiskers do not. VRU involvement is the largest, most consistent effect in both real-crash datasets."),
  P("Fig. 6(a) places every ROC-AUC reported against real crash records on one axis, with 95% confidence intervals where we report them, so the modest NHAI discrimination and the markedly stronger black-spot precursor and STATS19 figures are read off a common scale rather than compared across separate paragraphs."),
  ...figureImage("fig_auc_comparison.png", 500, 6, "Discrimination (ROC-AUC) across every experiment validated on real crash or precursor data (a), and across the controlled fusion-design study of Section IV-E (b). Error bars are 95% confidence intervals where reported."),
  H2("C", "Per-rider vulnerability detector"),
  P("A YOLOv11s detector, fine-tuned for helmet, no-helmet, triple-riding, and plate classes on 11,195 training images at 640px resolution (batch size 12), evaluated on 383 held-out images after training to 25 epochs with the best checkpoint at epoch 15, reaches an overall mAP@50 of 78.2%. Per class, triple-riding reaches 91.0, plate 83.2, no-helmet 75.6, and with-helmet 62.9, the noisiest class with only 27 validation instances. We present this as a component metric feeding the vulnerability multiplier above, not as a leaderboard claim."),
  P("Fig. 7 shows the same detector running frame-by-frame on recorded Indian street footage in the deployed Vehicle Intelligence view, with the resulting multiplier of Eq. (3) reported live alongside the detections it is computed from."),
  ...figureImage("screenshot_vehicle_intel.png", 480, 7, "The deployed Vehicle Intelligence view: the fine-tuned YOLOv11 detector running on recorded Indian street footage, with per-rider helmet/no-helmet/triple-riding boxes and the resulting scene-level multiplier m (Eq. (3)) reported top right."),
  H2("D", "Predictive black-spot discovery: evaluation"),
  runIn("1) Controlled evaluation:", "Across 40 random seeds and two traffic volumes, comparing a genuinely dangerous stretch against a busy-but-safe one, the engine achieves 100% detection and 0% false positives on the busy-but-safe road, which is the load-bearing result here: it shows the system is flagging danger rather than merely traffic volume. Median lead time over iRAD’s own reactive threshold is one day on the busy stretch and 7.5 days on the quiet one, against iRAD’s own 170 to 888 days, or never, within its three-year window. We are explicit that this is a controlled evaluation against authored ground truth, and that a true field retrospective against MoRTH’s published black-spot list needs near-miss telemetry for real Indian locations, which is not publicly available."),
  P("Fig. 8 shows the deployed Black-Spot Intelligence view the engine of Algorithm 2 renders this evaluation into: nominated stretches sized by near-miss count and coloured by the countermeasure category, which is the same 500 m unit and Wilson-ranked output iRAD’s own reactive criterion is compared against above."),
  ...figureImage("screenshot_blackspots.png", 480, 8, "The deployed Black-Spot Intelligence view: five stretches nominated from near-misses (Algorithm 2), marker size proportional to near-miss count and colour indicating the recommended engineering, enforcement, or education response."),
  runIn("2) A negative retrospective result on real crashes:", "Field validation against MoRTH’s black spots needs near-miss telemetry that nobody publishes, but real crash data does permit a test of the hypothesis underneath predictive discovery: that lower-severity crashes at a stretch anticipate the severe ones before iRAD’s own rule would catch them. Using the de-duplicated NHAI records above, we build 831 real 500 m cells across three inferred road segments, of which 94 meet iRAD’s own rule of five or more fatal or grievous crashes within three years. The design, including a permutation-based null, was fixed in advance. A precursor rule requiring three or more minor or non-injury crashes within a trailing year fires before iRAD qualification in 52% of the 94 qualifying cells, a median of 329 days ahead; but a severity-permutation null, which shuffles severities among the same crashes within each road while holding places and dates fixed, gives 51% and 276 days (p=0.41; thresholds of two and four crashes give p≥0.47), which indicates the apparent lead time is a crash-volume effect rather than a severity effect. On the prediction side, splitting each road at its median crash date, a cell’s earlier fatal-or-grievous count predicts two or more such crashes later with an AUC of 0.68 (95% CI 0.61–0.74); earlier minor crashes alone reach 0.64; total crash volume reaches 0.69. A road-adjusted logistic model using both fatal history and minor-crash history reaches an AUC of 0.755, but the identical model with the minor-crash term removed also reaches 0.755, so the minor crashes’ own contribution beyond fatal history and road identity is an AUC difference of 0.000 (95% CI −0.005 to +0.005), and their Poisson rate ratio given fatal-crash history is 1.04 (95% CI 0.99–1.09, p=0.10). An earlier version of this comparison, run against road-blind scores rather than a road-adjusted baseline, appeared to favour the combined model; adding the road-adjusted control showed that apparent gain was entirely road-level base rates, not the minor-crash signal, and we report this corrected analysis, superseding our earlier, upward-biased comparison. We therefore find no evidence, on real Indian crash records, that lower-severity crashes carry predictive information beyond a stretch’s own severe-crash history and traffic volume. This is not a test of near-miss telemetry, which is a richer and far more frequent signal than recorded minor crashes and is what the deployed engine actually consumes, and that question remains untested; three inferred road segments and 227 positive cells also limit the statistical power available to detect a smaller effect."),
  H2("E", "Learned fusion and interaction analysis"),
  P("On a controlled ground truth where risk genuinely compounds across factors, a learned fusion model outperforms the hand-set additive rule (ROC-AUC 0.781 for the rule, 0.815 for a linear learned model, and 0.819 for a gradient-boosted model, all calibrated, with Brier scores around 0.16). Friedman’s H-statistic applied to the gradient-boosted model recovers the three interactions the rule-based system was authored to encode among its top three by strength: speed-by-road at 0.25, speed-by-VRU at 0.22, and distraction-by-VRU at 0.19. The transparent rule is what ships; the learned model is evidence that the same architecture admits a learned, calibrated fusion when labelled telemetry becomes available. We use the H-statistic rather than SHAP deliberately, since the shipped model is already exactly additive and needs no post-hoc attribution. Fig. 6(b) plots the three ROC-AUC figures side by side against the accuracy-versus-interpretability trade-off discussed in Section V."),
  H2("F", "Supporting components"),
  P("A YOLOv11s road-damage detector, fine-tuned for 55 epochs at 640px resolution on the Indian split of RDD2022 [12], is evaluated on 1,542 held-out images (Table III). Overall mAP@50 is 33.0% (mAP@50–95: 14.2%); we present this as a working component, not a state-of-the-art result, and report the weakest class rather than only the strongest two. Alligator cracks and potholes, the damage types most relevant to vehicle-level risk, are detected reasonably well (57.7% and 44.3% mAP@50); transverse cracks are close to non-functional at 1.9% mAP@50, almost certainly a thin, low-instance-count class that would need more data or class-balancing before being relied on, and we disclose it rather than folding it into the aggregate."),
  tableCaption("III", ""),
  tableSubCaption("Road-damage detector, per class"),
  makeTable([3000, 1800, 1800], damageRows),
  P(" "),
  P("On the temporal-forecast side, we found, somewhat to our own surprise, that the linear extrapolation currently shipped (mean absolute error 19.0) is actually worse than simple persistence (13.4), while a small LSTM model (10.1) cuts error by roughly 47% relative to the shipped approach, a finding we report against ourselves rather than only against a weaker baseline."),
];

// =================================================================
// V. DISCUSSION / VI. LIMITATIONS / VII. CONCLUSION
// =================================================================
const discussion = [
  H1(5, "Discussion"),
  P("The result this paper is built around is Section IV-B: the model’s premise is not asserted from authored scenarios but demonstrated on six figures’ worth of real crashes, with statistical significance, calibration, and an ablation behind it. The system-level inversions we set out to make are each defended against the prior art surveyed in Section II: predictive instead of reactive, VRU-first rather than occupant-centric, observability-aware instead of silently confident, and explainable by construction rather than by post-hoc attribution. We would also argue that the honesty running through this work is itself part of the contribution: dropping unmeasured factors instead of guessing them, reporting an uncertainty band instead of a false point estimate, demoting an interaction effect the eye initially over-read, and publishing a negative result rather than quietly dropping the experiment that produced it."),
  P("A further trade-off worth stating explicitly is interpretability against ceiling accuracy. Section IV-E shows a learned, gradient-boosted fusion model reaching a materially higher ROC-AUC (0.819) than the transparent additive rule it is compared against (0.781) on the same controlled ground truth. We ship the rule anyway: every factor contribution it reports is the literal arithmetic behind the score rather than a post-hoc approximation of one, and an operator reading an alert, not a researcher reading a paper, is the system’s actual audience. The learned variant remains an upgrade path for whenever labelled Indian telemetry exists to train and calibrate it responsibly, rather than something shipped on data it was never validated against."),
  P("A second trade-off is geographic transfer. The factor structure validated in Section IV-B and corroborated on Indian data immediately after it transfers in direction, and for several factors in relative order of importance; it does not necessarily transfer in magnitude. Britain’s protected-cyclist environment suppresses a fatality channel that is far more exposed on an Indian road, and neither Indian crash source used here carries the labelled live-telemetry factors the deployed fusion engine actually consumes. The Indian results in this paper therefore validate the premise behind the system rather than its live risk score directly, a distinction Section VI returns to."),
  H1(6, "Limitations and Future Work"),
  P("The headline predictive-discovery claim remains simulation-only. The highest-value next experiment is a field retrospective against MoRTH’s own black-spot list, which requires near-miss telemetry for real Indian locations, meaning a data partnership with traffic police, a city, or iRAD itself, not a modelling change on our end. External validation of the factor structure, similarly, is British rather than Indian data; the factor structure appears to transfer, but the magnitudes and the India-specific vehicle mix, auto-rickshaws and six-up motorcycles among them, likely do not, and an Indian labelled crash-feature dataset is the asset that would let us check. Perception itself is presently a COCO-pretrained baseline for general road users, with the fine-tuned helmet detector as the one exception; we make no leaderboard claim there and none is needed for the argument this paper makes. Finally, the learned fusion model described in Section IV-E is not what ships; it waits on labelled Indian telemetry that does not yet exist, and the transparent rule-based model remains what runs in production."),
  H1(7, "Conclusion"),
  P("Road safety for the roads India actually has needs a system that acts before the crash, protects the people most exposed to it, and is honest about what it cannot see. We have presented one, and, we believe unusually for a project of this kind, shown that the factor relationships it rests on hold up on real crash records rather than only on scenarios we authored ourselves. The gap that remains is real Indian field data for the predictive black-spot claim specifically, and we have named that as the next experiment throughout this paper rather than quietly working around it."),
];

// =================================================================
// APPENDIX / ACKNOWLEDGMENT / REFERENCES
// =================================================================
const reproRows = [
  ["Result", "Command"],
  ["External validation (real crashes)", "ai.trie.external_validation"],
  ["Statistical validation (ORs, interactions, calibration)", "ai.trie.statistical_validation"],
  ["Conformal coverage guarantee", "ai.trie.conformal_validation"],
  ["Indian corroboration (2,898 fatal crashes)", "ai.trie.india_validation"],
  ["Indian inferential severity model (4,058 crashes)", "ai.trie.india_severity_model"],
  ["Black-spot precursor test (negative result)", "ai.trie.blackspot_crash_validation"],
  ["Black-spot discovery evaluation", "ai.blackspot.evaluate"],
  ["Learned-fusion study", "ai.trie.fusion_study"],
  ["Interaction analysis (H-statistic)", "ai.trie.interaction_analysis"],
  ["Temporal forecast study", "ai.temporal_prediction.forecast_study"],
  ["Helmet detector evaluation", "ai.training.train_helmet --evaluate"],
  ["Road-damage detector evaluation", "ai.training.train_road_damage --evaluate"],
];

const appendix = [
  H1plain("Appendix: Reproducibility"),
  P("Every quantitative result in this paper is one command away in the open-source repository (Table IV)."),
  tableCaption("IV", ""),
  tableSubCaption("Reproducing every result"),
  makeTable([4500, 3500], reproRows),
  P(" "),
  P("Every command above is prefixed with python -m and is run from the repository root; each one downloads or regenerates its own public source data rather than relying on a vendored copy."),
  H1plain("Acknowledgment"),
  P("This work received no external funding."),
];

const refList = [
  "Ministry of Road Transport & Highways, Government of India, Road Accidents in India, annual reports, 2021–2024.",
  "D. Gettman, L. Pu, T. Sayed, and S. Shelby, Surrogate Safety Assessment Model and Validation: Final Report, Federal Highway Administration, Rep. FHWA-HRT-08-051, 2008.",
  "C. Johnsson, A. Laureshyn, and T. De Ceunynck, “In search of surrogate safety indicators for vulnerable road users: a review of surrogate safety indicators,” Transp. Rev., vol. 38, no. 6, pp. 765–785, 2018, doi: 10.1080/01441647.2018.1442888.",
  "E. Hauer, D. W. Harwood, F. M. Council, and M. S. Griffith, “Estimating safety by the empirical Bayes method: a tutorial,” Transp. Res. Rec., vol. 1784, pp. 126–131, 2002, doi: 10.3141/1784-16.",
  "American Association of State Highway and Transportation Officials, Highway Safety Manual, 1st ed. Washington, DC, USA: AASHTO, 2010.",
  "W. Cheng and S. P. Washington, “Experimental evaluation of hotspot identification methods,” Accid. Anal. Prev., vol. 37, no. 5, pp. 870–881, 2005, doi: 10.1016/j.aap.2005.04.015.",
  "I. Chang, H. Park, E. Hong, J. Lee, and N. Kwon, “Predicting effects of built environment on fatal pedestrian accidents at location-specific level: application of XGBoost and SHAP,” Accid. Anal. Prev., vol. 166, 2022, Art. no. 106545.",
  "World Health Organization, Helmets: A Road Safety Manual for Decision-Makers and Practitioners. Geneva, Switzerland: WHO, 2006, ISBN 978-92-4-156299-7 (2nd ed., 2023).",
  "Department for Transport (Great Britain), Road Safety Data (STATS19), 2024.",
  "H. Khanum, A. Garg, M. I. Faheem, and R. Kulkarni, “Accident data of selected Indian highways for accident severity prediction using machine learning models,” dataset, Zenodo, 2025, doi: 10.5281/zenodo.16946653.",
  "Sharma et al., “Media-reported fatal road traffic crash data, India 2022–2023,” Data in Brief, 2025, Mendeley Data, doi: 10.17632/bc5sv6wnd9.7.",
  "D. Arya, H. Maeda, S. K. Ghosh, D. Toshniwal, and Y. Sekimoto, “RDD2022: a multi-national image dataset for automatic road damage detection,” Geosci. Data J., vol. 11, no. 4, 2024, doi: 10.1002/gdj3.260. Preprint: arXiv:2209.08538, 2022.",
];

const references = [
  H1plain("References"),
  ...refList.map((txt, idx) => new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 120, line: 264 },
    indent: { left: 360, hanging: 360 },
    children: [new TextRun({ text: `[${idx + 1}]  `, size: SMALL }), new TextRun({ text: txt, size: SMALL })],
  })),
];

module.exports = {
  FONT, BODY_SIZE, SMALL, dims, figureImage, equationImage, algorithmImage,
  P, runIn, H1, H1plain, H2, bullet, b, i, r, sup, cell, makeTable, tableCaption, tableSubCaption,
  front, introduction, relatedWork, systemMethod, results, discussion, appendix, references,
  Paragraph, TextRun, AlignmentType, HeadingLevel, Document, Packer,
};

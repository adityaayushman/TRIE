# Outreach plan: real Indian data + a pilot

The one lever that turns this from a strong applied paper into top-tier,
deployable, fundable work is **real Indian field data**. This is the playbook to
get it — realistic for an individual researcher, sequenced by what actually
opens.

The honest exchange you offer: a **novel, validated, fully-reproducible system**
(predictive black-spot discovery, VRU-first fusion with a conformal coverage
guarantee, already validated on 128k real crashes) + a **paper-ready
methodology**. What you need back: **real Indian crash/near-miss data**, or camera
access for a small pilot. That trade is genuinely attractive to the right partner.

---

## The strategy — go where the data already lives

Do **not** cold-pitch a government department first; as an individual that rarely
converts. Lead with an **academic collaboration** — a lab that already holds data
access and credibility, and co-authors the paper with you. Then use that
affiliation to reach cities/NGOs for a camera pilot.

**Three tiers of ask** (open the smallest that unlocks the claim):

1. **Retrospective data** *(smallest, highest-value first ask).* A crash dataset
   with location + a few features (speed limit, light, road-user type, severity),
   ideally the iRAD/e-DAR fields for one district or corridor. This alone lets you
   *replace the UK STATS19 validation with an Indian one* and *field-validate
   black-spot discovery against known MoRTH black spots* — the two experiments that
   move the paper to top-tier.
2. **Camera access** *(medium).* A few hours of CCTV/junction footage from a Smart
   City ICCC or a corridor, to run perception + near-miss detection on real Indian
   scenes (also finishes the IDD-fine-tuned perception story).
3. **A monitored pilot** *(largest).* Run the system live on a corridor for weeks,
   compare its black-spot nominations against what crashes/near-misses actually
   occur. This is the deployment evidence for funding and the "future of India"
   claim.

---

## Target list (real, specific doors)

| Target | Why them | What to ask | The door |
|---|---|---|---|
| **RBG Labs, IIT Madras** | Conceived & runs **iRAD/e-DAR** analytics for MoRTH — the actual academic home of India's national crash database | Research collaboration + iRAD data access for a district/corridor; co-authored validation | [coers.iitm.ac.in/irad](https://coers.iitm.ac.in/irad/) → the faculty leading iRAD analytics |
| **TRIPC, IIT Delhi** (Transportation Research & Injury Prevention Centre) | 20+ years of road-safety research; publishes the *India Status Report on Road Safety*; has crash data + VRU focus that matches yours exactly | A student/visiting collaboration; access to their crash datasets; joint paper | [tripc.iitd.ac.in](https://tripc.iitd.ac.in/) → contact/faculty page |
| **WRI India (Ross Center, Safer Roads / Vision Zero)** | Runs **black-spot mitigation with Bengaluru Smart City**; does city-level crash-data analysis | A pilot on one of their corridors; their crash data for validation | [wricitiesindia.org](https://www.wricitiesindia.org/content/safer-roads-vision-zero) |
| **SaveLIFE Foundation** | Runs **Zero-Fatality-Corridor** programmes with state govts (data + on-ground access) | Predictive black-spot layer on an existing corridor | savelifefoundation.org |
| **A Smart City ICCC** (e.g., Bengaluru, Pune, Surat) | Integrated Command & Control Centres already have **live junction CCTV** | A short camera-feed pilot on 2–3 junctions | via the WRI/TRIPC intro, not cold |

**Sequencing:** email TRIPC (IIT Delhi) and RBG Labs (IIT Madras) *first* — an
academic collaboration is the most realistic unlock and gives you the affiliation
+ credibility to approach the rest.

---

## The value proposition (lead with what *they* get)

- **Predictive, not reactive.** iRAD flags a stretch after 5 fatal crashes / 10
  deaths in 3 years. This nominates the same 500 m from **near-misses, days
  earlier** — prioritising a limited engineering budget before people die.
- **VRU-first**, for the 66.8% of Indian deaths that are riders and pedestrians —
  the road users the imported ADAS paradigm never scores.
- **Explainable + honest uncertainty** (a conformal coverage guarantee) —
  auditable, which matters for public accountability.
- **Reproducible and open** — every result is one command; no black box.
- **You do the work.** You bring the system, the analysis, and the writing; they
  bring data and domain review. Clear co-authorship.

State the honest limitation up front — it builds trust: *"validated so far on UK
crash records and simulation; your data is exactly what closes the gap to an
Indian field result."*

---

## Email templates (fill the [brackets])

### A — Academic collaboration (IIT Delhi TRIPC / IIT Madras RBG Labs) — send this first

> **Subject:** Collaboration: predictive, VRU-first black-spot discovery — validating on Indian data
>
> Dear Prof. [Name],
>
> I'm Aditya Ayushman Sahoo, an independent researcher. I've built an open,
> reproducible transportation-risk system for Indian roads that inverts the three
> assumptions of imported road-safety tools: it is **predictive** (nominates
> black spots from near-misses before a crash record exists, vs iRAD's reactive
> rule), **VRU-first** (weighted for the 66.8% of deaths who are riders and
> pedestrians), and **explainable with a conformal coverage guarantee**.
>
> It is already validated on 128k real crash records (UK STATS19: the model's
> factors predict fatal outcomes at AUC 0.72, calibrated) and in a 40-seed
> black-spot simulation — but the honest gap is real **Indian** field data, which
> is where [TRIPC / RBG Labs] would be the ideal collaborator.
>
> I'd value 20 minutes to explore a joint study: I bring the full system,
> analysis and writing; access to iRAD/e-DAR fields for even one district (or your
> crash datasets) would let us produce the first Indian field validation and a
> strong joint publication. The code, a methodology paper draft, and a live demo
> are ready to share.
>
> Live system: https://trie-dashboard.vercel.app · Research/methods:
> https://trie-dashboard.vercel.app/research · Code: https://github.com/adityaayushman/TRIE
>
> Thank you for your time.
> Aditya Ayushman Sahoo · adityaasahoo@gmail.com

### B — NGO / Smart City pilot (WRI India, SaveLIFE, an ICCC)

> **Subject:** A predictive black-spot layer for [corridor/city] — short pilot proposal
>
> Dear [Name / Team],
>
> Your black-spot mitigation work in [Bengaluru / corridor] is exactly where a
> predictive layer helps. I've built an open system that nominates dangerous 500 m
> stretches from **near-misses, before crashes accrue**, VRU-first and fully
> explainable — validated on 128k real crashes and in simulation.
>
> I'd like to propose a small, no-cost pilot: run it on a few junctions of an
> existing corridor (from CCTV feeds you already have), and compare its
> nominations against the crashes/near-misses that follow. I bring the system and
> the analysis; you'd provide footage or crash records for a defined stretch.
>
> [links as above]

---

## One-page pilot / collaboration proposal (outline to attach)

1. **Problem** — reactive, occupant-centric, opaque safety tooling on Indian roads
   (MoRTH figures: 1.7 lakh deaths, 66.8% VRUs).
2. **What the system does** — the four contributions, one paragraph each, with the
   already-measured evidence (STATS19 AUC 0.72 + conformal guarantee; 40-seed
   discovery eval; helmet detector mAP 78%).
3. **The ask** — one tier from the table above, stated as the *minimal* data that
   unlocks the result.
4. **What you provide** — system, integration, analysis, paper writing, a live
   demo; no cost to the partner.
5. **What they provide** — data (iRAD fields / crash records / CCTV) for a defined
   scope, plus domain review.
6. **Deliverables & timeline** — e.g. 8–12 weeks: (a) Indian field validation of
   the fusion, (b) black-spot nomination vs their known black spots, (c) a joint
   paper + a report they can use.
7. **Success metrics** — detection rate & false-positive rate vs their known black
   spots; lead time vs iRAD; calibration on Indian outcomes.
8. **IP / data** — data stays theirs; code stays open; co-authorship agreed up
   front.

---

## Practical notes

- **Volume:** send 5–8 tailored emails, not one blast. Personalise the first line
  to their actual work (cite a specific project/report of theirs).
- **Lead with the live demo** — a working, honest system on screen converts far
  better than a PDF.
- **Have the paper draft ready** (`paper/smart-road-guardian.md`) — attach it to
  serious replies; it signals you'll do the writing.
- **Expect a low hit rate** — 5–8 sends, maybe 1–2 real conversations. That's
  normal and enough; you need *one* data partner.

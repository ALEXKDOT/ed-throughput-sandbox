# Sources and claim map

## Evidence boundary

ED Throughput Sandbox uses literature to support its **conceptual organization, terminology, and modeling methods**. It does not use the literature to claim that the app's defaults reproduce a typical emergency department. No source below is cited as validating the app, its presets, or a real-world intervention.

The source types used here are:

- **Conceptual basis:** organizes the problem but does not prescribe a simulation or parameter values.
- **Modeling precedent:** shows that a method has been used in peer-reviewed ED research; it does not make this app's implementation or inputs empirically valid.
- **Government/professional definition:** supplies current terminology or system framing without being treated as a regulatory measure.
- **Simulation methodology:** supports experiment design, uncertainty handling, or verification/validation outside the ED-specific literature.

Bibliographic identifiers and links were checked against PubMed, DOI/publisher records, or the issuing government agency on 2026-08-31.

## At-a-glance claim map

| ID                                    | Source role                 | What it supports here                                                                                                                                                      | What it does **not** support                                                                                            |
| ------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| [S1](#s1-asplin-et-al-2003)           | Conceptual basis            | Input-throughput-output organization and their interdependence                                                                                                             | Any numerical default; a claim that crowding has one cause                                                              |
| [S2](#s2-hoot-et-al-2008)             | ED modeling precedent       | Patient-level DES; nonstationary Poisson arrivals; categorical acuity; acuity-dependent lognormal evaluation/treatment; Bernoulli admission; operational crowding measures | This app's arrival rate, mix, medians, variability, admission rates, or forecast validity                               |
| [S3](#s3-bair-et-al-2010)             | ED modeling precedent       | DES representation of boarding and a boarding-release policy; studying boarding's modeled operational effects                                                              | The app's 240-minute default, 72-hour cap, or a universal effect size; direct manipulation of inpatient bed count       |
| [S4](#s4-connelly-and-bair-2004)      | ED modeling precedent       | DES for system-level ED operations and comparison of a fast-track/triage configuration                                                                                     | The app's four-space allocation, 60-minute fast-track duration, or a guaranteed benefit from fast track                 |
| [S5](#s5-law-2015)                    | Simulation methodology      | DES construction, random variates, independent replications, output analysis, warm-up reasoning, and comparing alternatives                                                | The choice of exactly 24 warm-up hours, 100 replications, or any clinical parameter                                     |
| [S6](#s6-ahrq-2025)                   | Government technical report | Boarding begins after an admission decision when the patient remains in the ED awaiting inpatient placement; boarding as an output/system-flow issue                       | A claim that the model represents the inpatient system, an official AHRQ/HHS position, or a regulatory boarding measure |
| [S7](#s7-grassmann-2014)              | Simulation methodology      | Empty-start initialization can bias steady-state output; warm-up choice is context-dependent                                                                               | Proof that this app's one-day warm-up is sufficient                                                                     |
| [S8](#s8-yang-and-nelson-1991)        | Simulation methodology      | Common random numbers as a variance-reduction design for comparisons                                                                                                       | Guaranteed variance reduction for every model or metric                                                                 |
| [S9](#s9-sargent-2013)                | Simulation methodology      | Distinction among conceptual-model validity, implementation verification, operational validity, and data validity                                                          | Evidence that passing code tests makes this uncalibrated app empirically valid                                          |
| [S10](#s10-doudareva-and-carter-2022) | ED methodology review       | Need for explicit verification and validation; documented validation gaps in ED DES studies                                                                                | Validation of this app or its assumptions                                                                               |

## Verified references

### S1. Asplin et al. (2003)

Asplin BR, Magid DJ, Rhodes KV, Solberg LI, Lurie N, Camargo CA Jr. A conceptual model of emergency department crowding. _Annals of Emergency Medicine_. 2003;42(2):173–180.

- DOI: [10.1067/mem.2003.302](https://doi.org/10.1067/mem.2003.302)
- PMID: [12883504](https://pubmed.ncbi.nlm.nih.gov/12883504/)
- Role: conceptual basis.
- Claim mapping: the paper explicitly partitions ED crowding into three interdependent input, throughput, and output components. That organization is the basis of the product's control groups and explanatory map.
- Boundary: it does not specify this app's queue discipline, distributions, default values, fast-track rules, warm-up, replications, or metrics.

### S2. Hoot et al. (2008)

Hoot NR, LeBlanc LJ, Jones I, Levin SR, Zhou C, Gadd CS, Aronsky D. Forecasting emergency department crowding: a discrete event simulation. _Annals of Emergency Medicine_. 2008;52(2):116–125.

- DOI: [10.1016/j.annemergmed.2007.12.011](https://doi.org/10.1016/j.annemergmed.2007.12.011)
- PMID: [18387699](https://pubmed.ncbi.nlm.nih.gov/18387699/)
- PMCID: [PMC7252622](https://pmc.ncbi.nlm.nih.gov/articles/PMC7252622/)
- Role: primary peer-reviewed ED modeling precedent.
- Claim mapping: ForecastED represented patient flow with a DES. Its published process diagram identifies arrivals as a nonstationary Poisson process, acuity as a multinomial distribution, evaluation/treatment duration as acuity-dependent lognormal, and admission as an acuity-dependent Bernoulli trial. It evaluated operational measures including waiting, occupancy, LOS, boarders, and boarding time.
- Boundary: ForecastED was fitted and validated with patient data from an academic ED and included processes this sandbox omits, including leaving without being seen and stochastic hospital-bed openings. Its parameters and performance are not transferred to this synthetic app. Citation here supports modeling form, not this app's numbers or forecasting ability.

### S3. Bair et al. (2010)

Bair AE, Song WT, Chen Y-C, Morris BA. The impact of inpatient boarding on ED efficiency: a discrete-event simulation study. _Journal of Medical Systems_. 2010;34(5):919–929.

- DOI: [10.1007/s10916-009-9307-4](https://doi.org/10.1007/s10916-009-9307-4)
- PMID: [20703616](https://pubmed.ncbi.nlm.nih.gov/20703616/)
- PMCID: [PMC2935970](https://pmc.ncbi.nlm.nih.gov/articles/PMC2935970/)
- Role: primary peer-reviewed ED modeling precedent.
- Claim mapping: the study used DES to examine operational consequences of boarding. Its decision variable was a “boarder-released-ratio,” the fraction of admitted patients assigned zero boarding time/released to an inpatient bed, and it evaluated simulated crowding and leaving-without-being-seen outcomes.
- Boundary: the study did **not** directly vary inpatient bed count, and its reported effect sizes are not used as expectations for this app. It does not support the sandbox's boarding median, distribution, cap, admission probabilities, or any causal real-world claim.

### S4. Connelly and Bair (2004)

Connelly LG, Bair AE. Discrete event simulation of emergency department activity: a platform for system-level operations research. _Academic Emergency Medicine_. 2004;11(11):1177–1185.

- DOI: [10.1197/j.aem.2004.08.021](https://doi.org/10.1197/j.aem.2004.08.021)
- PMID: [15528582](https://pubmed.ncbi.nlm.nih.gov/15528582/)
- Role: primary peer-reviewed ED modeling precedent.
- Claim mapping: the paper describes an ED DES, compares model output with observed service times, and uses the model to compare fast-track triage with an alternative acuity-ratio approach. It also reports tradeoffs across acuity groups rather than a universally favorable direction.
- Boundary: the study's institution, detailed resources, patient inputs, and triage alternatives differ from this app. It does not support allocating four spaces, a 60-minute fast-track median, or a claim that fast track must improve any outcome.

### S5. Law (2015)

Law AM. _Simulation Modeling and Analysis_. 5th ed. New York, NY: McGraw-Hill Education; 2015.

- ISBN-13: 978-0-07-340132-4
- Publisher record: [McGraw-Hill Education](https://www.mheducation.com/highered/product/Simulation-Modeling-and-Analysis-Law.html)
- Role: general simulation-methodology reference.
- Claim mapping: the text covers DES construction, input distributions, pseudorandom-number generation, random-variate generation, output analysis for one system, and comparison of alternative configurations. Those topics inform independent replications, warm-up/data deletion, seeded randomness, and paired comparisons.
- Boundary: it does not prescribe this app's exact warm-up length, replication count, PRNG, distribution parameters, or ED logic.

### S6. AHRQ (2025)

Weinick RM, Bruna S, Boicourt RM, Michael SS, Sessums LL. _AHRQ Summit to Address Emergency Department Boarding: Technical Report_. Rockville, MD: Agency for Healthcare Research and Quality; 2025. AHRQ Publication No. 25-0042.

- Report: [AHRQ technical report PDF](https://www.ahrq.gov/sites/default/files/wysiwyg/topics/ed-boarding-summit-report.pdf)
- Agency topic page: [AHRQ Emergency Department](https://www.ahrq.gov/topics/emergency-department.html)
- DOI/PMID: none assigned.
- Publication note: the prepared-by page is dated January 2025; the final AHRQ publication colophon is March 2025. This bibliography uses the final publication year and report number.
- Role: government technical-report definition and system framing.
- Claim mapping: the report describes ED boarding as a patient remaining physically in the ED after an admission decision because an inpatient bed is unavailable and identifies it as an ED output/hospital-system-flow problem.
- Boundary: the report itself says its content should not be interpreted as an official AHRQ or HHS position. The sandbox has no explicit admission-decision event or inpatient-bed system. It uses treatment completion as a transparent proxy for the disposition/admission decision and models a configurable aggregate interval. Its boarder-hours are therefore model-defined, not an AHRQ, CMS, or accreditation measure.

### S7. Grassmann (2014)

Grassmann WK. Factors affecting warm-up periods in discrete event simulation. _Simulation_. 2014;90(1):11–23.

- DOI: [10.1177/0037549713508334](https://doi.org/10.1177/0037549713508334)
- Role: peer-reviewed simulation-methodology source.
- Claim mapping: the article discusses initialization bias, the common use of a no-data-collection warm-up, and factors affecting the appropriate length.
- Boundary: it also explains that warm-up can be redundant or detrimental under some initialization strategies. It does not justify choosing 24 hours for this app; the one-day period is a disclosed product choice that should be stress-tested.

### S8. Yang and Nelson (1991)

Yang W-N, Nelson BL. Using common random numbers and control variates in multiple-comparison procedures. _Operations Research_. 1991;39(4):583–591.

- DOI: [10.1287/opre.39.4.583](https://doi.org/10.1287/opre.39.4.583)
- Role: primary simulation-methodology source.
- Claim mapping: the paper studies common random numbers as a variance-reduction technique when comparing simulated alternatives. This supports pairing A/B replications on shared exogenous random inputs and analyzing within-pair differences.
- Boundary: positive covariance and variance reduction are not automatic. The app therefore says CRN can make deltas less noisy, not that it always will.

### S9. Sargent (2013)

Sargent RG. Verification and validation of simulation models. _Journal of Simulation_. 2013;7(1):12–24.

- DOI: [10.1057/jos.2012.20](https://doi.org/10.1057/jos.2012.20)
- Role: peer-reviewed simulation-methodology source.
- Claim mapping: the article distinguishes conceptual-model validity, model verification, operational validity, and data validity and describes validation techniques and documentation.
- Boundary: invariants and deterministic tests can verify implementation against the specification; they cannot validate an uncalibrated model against a real ED.

### S10. Doudareva and Carter (2022)

Doudareva E, Carter MW. Discrete event simulation for emergency department modelling: a systematic review of validation methods. _Operations Research for Health Care_. 2022;33:100340.

- DOI: [10.1016/j.orhc.2022.100340](https://doi.org/10.1016/j.orhc.2022.100340)
- Role: peer-reviewed ED simulation-methodology review.
- Claim mapping: the review compares best-practice simulation validation approaches with those reported in ED DES studies and documents incomplete verification/validation reporting across much of the literature. It supports publishing explicit logic, invariants, fixtures, and validity boundaries.
- Boundary: it is a review, not a parameter source, and does not validate this app.

## Parameter provenance

The following are **illustrative project assumptions**, not literature benchmarks:

| Project input or design choice            |                               Value in the model | Provenance statement                                            |
| ----------------------------------------- | -----------------------------------------------: | --------------------------------------------------------------- |
| Mean arrival rate                         |                                  6 patients/hour | Product brief; synthetic                                        |
| Arrival-profile vectors                   |                       Four stored 24-hour shapes | Original project profiles; synthetic                            |
| Acuity mix                                |                                  12% / 56% / 32% | Product brief; synthetic                                        |
| Treatment spaces                          |                                               24 | Product brief; synthetic                                        |
| Main treatment medians                    |                               240 / 180 / 90 min | Product brief; synthetic composite durations                    |
| Fast-track allocation and median          |                                4 spaces / 60 min | Product brief; synthetic                                        |
| Treatment lognormal `sigma` presets       |                               0.35 / 0.60 / 0.85 | Original project choices                                        |
| Treatment conditional-truncation bounds   |                                      5–1,440 min | Original computational guardrails                               |
| Admission probabilities                   |                                   45% / 18% / 3% | Product brief; synthetic                                        |
| Admission caps                            |                                  90% / 60% / 20% | Original scaling guardrails                                     |
| Boarding median                           |                                          240 min | Product brief; synthetic                                        |
| Boarding lognormal `sigma`                |                                             0.75 | Original project choice                                         |
| Boarding conditional-truncation bounds    |                         1–4,320 min when nonzero | Original computational guardrails                               |
| PRNG, seed mixer, and stream tags         |                  `edts-prng-v1-mulberry32-mix32` | Engineering reproducibility choice; not an empirical assumption |
| Conditional-lognormal numerical transform |                          `edts-distributions-v1` | Engineering reproducibility choice; not an empirical assumption |
| Warm-up and analysis                      |                                      24 h + 24 h | Product brief; length not empirically validated                 |
| Monte Carlo replications                  |                              100 default, 20–200 | Product brief; responsiveness/precision tradeoff                |
| Uncertainty display                       | Median and empirical P10–P90 across replications | Product/reporting choice; not a hospital confidence interval    |

## Claims intentionally not made

The repository and application must not state or imply that:

- the defaults describe an average, typical, recommended, or safe ED;
- the simulation has been calibrated or externally validated;
- one arrival process, duration distribution, or queue discipline is universally correct;
- a capacity, fast-track, admission, or boarding change will have the same effect in practice;
- a model delta establishes causality, patient benefit, or a staffing recommendation; or
- code verification is equivalent to empirical model validation.

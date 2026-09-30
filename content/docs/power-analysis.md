---
title: Planning your experiment (power analysis)
description: Work out how many replicates you need before you sequence.
category: data
order: 30
---

# Planning your experiment (power analysis)

The number of biological replicates decides what a differential expression study can detect, far more than sequencing depth. The **Power Analysis** tool (**Tools → Power Analysis**) helps you choose that number before you sequence, or judge what an existing design can detect.

The tool runs entirely in your browser, does not use your quota and is available on every plan.

## Two questions it answers

- **Calculate sample size**: *how many samples per group do I need to detect this effect?* You give the effect size and the target power.
- **Calculate power**: *with n samples per group, what are my chances of detecting this effect?* You give the effect size and the group size.

## The inputs

- **Test type**: two-sample t-test (two independent groups, the usual case), paired t-test (the same subjects before and after), or one-sample t-test. Keep **Two-tailed test (recommended)** on unless you only care about one direction of change.
- **Significance threshold α**: usually 0.05.
- **Effect size (Cohen's d)**: how large the difference is compared with the variability. The **Small**, **Medium** and **Large** presets give typical values.
- **Target power (1 – β)**: the probability of detecting a real effect. 0.8 (80%) is the usual target.

If you think in fold changes, use the built-in converter: it turns a log2 fold change and a coefficient of variation (CV) into an effect size (*d = |log2FC| / CV*). Take the CV from a pilot study or from published data on a similar system.

## Reading the result

The tool gives the answer, draws a **Power curve** (power against group size), and grades the design:

| Power | Meaning |
|---|---|
| Below 50% | Low: most real effects of that size will be missed. |
| 50–79% | Moderate: results will be hard to reproduce. |
| 80% and above | Adequate. |

> **Keep in mind:** a transcriptome study tests thousands of genes at once, and the multiple-testing correction makes each test stricter. Treat the result as a minimum. Three replicates per condition is a common floor, and GenoLens needs at least two per condition to run a comparison at all.

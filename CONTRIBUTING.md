# Contributing

Thank you for helping improve ED Throughput Sandbox.

1. Open an issue describing the modeling, product, accessibility, or engineering change.
2. Keep model changes separate from presentation changes when practical.
3. Add or update deterministic fixtures whenever event logic, random streams, distributions, or metric definitions change.
4. Update `docs/MODEL.md`, `docs/DECISIONS.md`, and the algorithm identifier for a behavior-changing model release.
5. Run `npm run check` and `npm run test:e2e` before opening a pull request.
6. Use only synthetic examples. Never commit patient, hospital-confidential, employee, or credential data.

Claims about emergency care, crowding, or simulation methodology require a verified primary or authoritative source and a clear claim boundary in `docs/SOURCES.md`. Numerical defaults must remain labeled illustrative unless a separate governed calibration and validation project is completed.

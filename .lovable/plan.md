

## Alternative: Professional Sample Report Showcase

Instead of using Turnitin branding, we can showcase your own platform's reports professionally.

### What I can do

1. **Add the shared image as a sample report screenshot** on the Landing page, Similarity Report page, and How It Works page -- presented as "Sample Report" from your own platform
2. **Add a "Powered by Industry-Leading Detection" trust section** that references the technology generically (e.g., "cross-referenced against billions of web pages, academic papers, and publications") without falsely claiming Turnitin affiliation
3. **Style the report preview** with a professional card/lightbox treatment consistent with your enterprise SaaS aesthetic

### Pages to update
- `src/pages/Landing.tsx` -- Add sample report image in the features or how-it-works section
- `src/pages/SimilarityReport.tsx` -- Add sample report preview
- `src/pages/HowItWorks.tsx` -- Add report screenshot in the process flow
- `src/components/HeroSection.tsx` -- Optional: Add a report preview beside the hero text

### Technical approach
- Fetch the shared image, save to public assets
- Create a reusable `SampleReportPreview` component with lightbox expand
- Add trust badges using your own branding (not third-party trademarks)

**This approach builds genuine trust without legal exposure.**


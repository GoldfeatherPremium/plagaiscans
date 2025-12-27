-- Insert article content into site_content table for admin editing
INSERT INTO public.site_content (content_key, content_value, section, description) VALUES
-- Article 1: How Similarity Detection Works
('article_1_title', 'How Similarity Detection Works in Academic Writing', 'articles', 'Title for the similarity detection article'),
('article_1_excerpt', 'Learn how modern academic platforms analyze documents for similarity by comparing text against comprehensive databases of sources.', 'articles', 'Short excerpt for the similarity detection article'),
('article_1_content', 'Modern academic platforms use sophisticated algorithms to analyze documents for similarity. The process involves breaking down submitted text into smaller segments and comparing them against vast databases of academic sources, publications, and web content.

When a document is submitted for analysis, the system first processes the text to identify meaningful phrases and sentences. These segments are then compared against indexed sources using pattern matching and semantic analysis techniques.

The comparison process considers multiple factors including exact phrase matches, paraphrased content, and structural similarities. Advanced systems can identify content that has been modified or rephrased while maintaining the original meaning.

Results are typically presented as a similarity percentage along with a detailed report highlighting specific matched sections. Each match is linked to its source, allowing users to review the context and determine whether proper citation is needed.

It''s important to understand that similarity doesn''t automatically indicate plagiarism. Properly cited quotes, common academic phrases, standard terminology, and referenced material will naturally appear as matches. The goal is to help authors identify areas that may need additional citation or original development.

Best practices for using similarity detection include running checks early in the writing process, reviewing each flagged section in context, and using the results as a learning tool to improve citation practices and develop more original content.', 'articles', 'Full content for the similarity detection article'),

-- Article 2: Understanding Plagiarism Reports
('article_2_title', 'Understanding Plagiarism Reports', 'articles', 'Title for the plagiarism reports article'),
('article_2_excerpt', 'A guide to interpreting similarity percentages, understanding matched sources, and using report insights to improve your writing.', 'articles', 'Short excerpt for the plagiarism reports article'),
('article_2_content', 'Plagiarism reports provide detailed insights into how your document compares to existing sources. Understanding how to read and interpret these reports is essential for maintaining academic integrity and improving your writing.

The overall similarity score represents the percentage of your document that matches content in the comparison database. However, this number alone doesn''t tell the whole story. A 30% similarity score could indicate proper use of cited sources, or it could suggest areas needing attention.

Individual matches are typically color-coded or highlighted to show different types of similarity. Direct quotes should be properly cited and are expected to match sources. Paraphrased content that closely follows the original structure may need additional revision or citation.

Source types matter when evaluating matches. Matches to academic journals and books may indicate proper research and citation, while matches to student paper databases could suggest more concerning similarities.

When reviewing your report, focus on context rather than percentages. A match in your literature review section is likely appropriate if properly cited, while the same match in your analysis section warrants closer examination.

Use the report as a learning tool. Identify patterns in your writing that frequently trigger matches and develop strategies to express ideas more originally. Consider whether you''re over-relying on certain sources and how you can incorporate your own analysis and interpretation.

Remember that the goal is not to achieve zero similarity, but to ensure all borrowed content is properly attributed and that your original contribution is clearly evident.', 'articles', 'Full content for the plagiarism reports article'),

-- Article 3: Academic Integrity in Modern Education
('article_3_title', 'Academic Integrity in Modern Education', 'articles', 'Title for the academic integrity article'),
('article_3_excerpt', 'Explore the importance of academic integrity, ethical scholarship, and how originality checking supports educational standards.', 'articles', 'Short excerpt for the academic integrity article'),
('article_3_content', 'Academic integrity is the foundation of meaningful education and scholarly work. It encompasses honesty, trust, fairness, respect, responsibility, and courage in all academic endeavors.

In modern education, academic integrity extends beyond avoiding plagiarism. It includes proper research practices, honest representation of data, fair collaboration, and ethical use of sources. Students and researchers who uphold these principles contribute to the advancement of knowledge and maintain the value of academic credentials.

The digital age has created new challenges for academic integrity. Information is more accessible than ever, making it easier to find and use sources but also more tempting to take shortcuts. Educational institutions have responded by implementing comprehensive integrity policies and using technology to detect potential violations.

Originality checking tools play an important role in supporting academic integrity. Rather than serving solely as detection mechanisms, they help students learn proper citation practices, develop original writing skills, and understand the importance of attribution.

Many institutions now integrate originality checking into the writing process rather than using it only for enforcement. Students can submit drafts, review their similarity reports, and revise their work before final submission. This approach emphasizes learning and improvement over punishment.

Building a culture of integrity requires effort from all stakeholders. Educators must clearly communicate expectations and provide guidance on proper practices. Students must commit to honest work and seek help when uncertain. Institutions must provide resources and support while maintaining fair enforcement of standards.

The benefits of academic integrity extend beyond the classroom. Students who develop strong ethical foundations are better prepared for professional careers where integrity is equally important.', 'articles', 'Full content for the academic integrity article'),

-- Article 4: AI Writing Indicators Explained
('article_4_title', 'AI Writing Indicators Explained', 'articles', 'Title for the AI writing indicators article'),
('article_4_excerpt', 'Understanding how AI content detection works, what indicators mean, and the importance of human judgment in reviewing results.', 'articles', 'Short excerpt for the AI writing indicators article'),
('article_4_content', 'AI content detection has become increasingly relevant as AI writing tools become more sophisticated and widely used. Understanding how these detection systems work helps users interpret results appropriately.

AI writing indicators analyze text patterns that may suggest machine-generated content. These patterns include statistical regularities in word choice, sentence structure, and overall writing style. AI-generated text often exhibits certain characteristics that differ from human writing.

Detection systems typically provide probability scores rather than definitive verdicts. A high probability score suggests the text exhibits patterns commonly associated with AI generation, but it doesn''t guarantee the content was actually produced by AI.

Several factors can influence detection results. Highly technical or formulaic writing may trigger false positives because it shares characteristics with AI output. Conversely, AI text that has been significantly edited may not be detected.

It''s crucial to approach AI detection results with appropriate skepticism. No detection system is 100% accurate, and results should be considered as one piece of evidence rather than conclusive proof. Human judgment remains essential in evaluating content authenticity.

The ethical considerations around AI writing are complex. In some contexts, AI assistance may be acceptable or even encouraged. In others, it may violate academic integrity policies. Understanding your institution''s specific guidelines is essential.

When AI content indicators appear in your work, review the flagged sections carefully. If you did not use AI tools, consider whether the writing style could be triggering false positives. If you did use AI assistance, ensure you''re complying with applicable guidelines and properly disclosing any AI involvement.

The landscape of AI writing and detection continues to evolve rapidly. Staying informed about current practices and policies helps ensure ethical and appropriate use of these powerful tools.', 'articles', 'Full content for the AI writing indicators article'),

-- Article 5: How to Improve Originality in Research
('article_5_title', 'How to Improve Originality in Research', 'articles', 'Title for the research originality article'),
('article_5_excerpt', 'Practical tips for developing original ideas, proper paraphrasing techniques, and effective citation practices.', 'articles', 'Short excerpt for the research originality article'),
('article_5_content', 'Developing original research contributions requires combining proper use of existing sources with your own unique insights and analysis. Here are practical strategies to improve the originality of your academic work.

Start by thoroughly understanding your sources before writing. When you deeply comprehend the material, you can express ideas in your own words more naturally. Avoid writing while looking directly at sources, which often leads to unintentional copying.

Develop a systematic note-taking approach. Clearly distinguish between direct quotes (with proper attribution), paraphrased ideas (with citations), and your own thoughts. This practice prevents accidental plagiarism and helps you track your original contributions.

Effective paraphrasing goes beyond word substitution. True paraphrasing involves understanding the core concept and expressing it through your own perspective and writing style. Change sentence structure, use different vocabulary, and integrate the idea into your own argument.

Synthesize multiple sources rather than summarizing them individually. Original work often comes from identifying connections between different sources, finding gaps in existing research, or applying established concepts to new contexts.

Develop your analytical voice. After presenting information from sources, explain what it means, why it matters, and how it relates to your thesis. This interpretation is where your original contribution becomes clear.

Use citation management tools to track sources from the beginning of your research. Proper attribution is not just about avoiding plagiarism—it demonstrates scholarly rigor and allows readers to explore your sources.

Plan time for revision focused specifically on originality. Review your draft to ensure your voice and analysis are prominent. Consider whether each section clearly shows the difference between source material and your own contribution.

Remember that originality doesn''t mean working in isolation. Engage with sources, but always add value through your analysis, synthesis, and perspective.', 'articles', 'Full content for the research originality article'),

-- Article 6: Citation Best Practices
('article_6_title', 'Citation Best Practices for Academic Papers', 'articles', 'Title for the citation best practices article'),
('article_6_excerpt', 'Master the art of proper citation with guidelines for different citation styles and common mistakes to avoid.', 'articles', 'Short excerpt for the citation best practices article'),
('article_6_content', 'Proper citation is fundamental to academic writing. It gives credit to original authors, allows readers to locate sources, and demonstrates the scholarly foundation of your work. Mastering citation practices strengthens your credibility as a researcher.

Different disciplines use different citation styles. APA (American Psychological Association) is common in social sciences, MLA (Modern Language Association) in humanities, Chicago in history and some other fields, and IEEE in technical disciplines. Understanding your field''s preferred style is essential.

Every citation style has specific rules for formatting in-text citations and reference lists. In-text citations typically include author names and publication dates or page numbers, while reference lists provide complete publication details for each source.

Common citation mistakes include inconsistent formatting, missing publication details, incorrect punctuation, and mismatched in-text citations and reference entries. Using citation management software can help prevent these errors.

Know when citation is required. Always cite direct quotes, paraphrased ideas, data, images, and any information that is not common knowledge. When in doubt, cite the source—it''s better to over-cite than to risk plagiarism.

Integrate citations smoothly into your writing. Avoid excessive use of direct quotes—paraphrase when possible to demonstrate understanding. Introduce sources with signal phrases that identify the author and their credentials or perspective.

Evaluate source quality before citing. Academic work should rely primarily on peer-reviewed sources, reputable publications, and authoritative texts. Be cautious with web sources and always verify credibility.

Keep detailed records from the start of your research. Note complete bibliographic information for every source you consult, even if you''re not sure you''ll use it. This practice saves time during final preparation and prevents incomplete citations.

Review your citations before submission. Verify that every in-text citation has a corresponding reference entry and vice versa. Check formatting against official style guides or recent examples from reputable journals in your field.', 'articles', 'Full content for the citation best practices article'),

-- Resources page content
('resources_hero_title', 'Resources & Learning Center', 'resources', 'Main title for resources page'),
('resources_hero_subtitle', 'Educational articles, guides, and tips to help you understand academic integrity and improve your writing.', 'resources', 'Subtitle for resources page'),
('resources_tips_title', 'Quick Tips for Academic Writing', 'resources', 'Title for tips section'),
('resources_similarity_title', 'Understanding Similarity in Academic Documents', 'resources', 'Title for similarity explanation section'),
('resources_similarity_content', 'Similarity in academic documents isn''t inherently problematic. Properly cited quotes, common terminology, standard methodological descriptions, and referenced material will naturally show as matches. The key distinction is between properly attributed content and unattributed copying.

When reviewing similarity reports, consider the context of each match. A high similarity percentage in a literature review section may be appropriate if sources are properly cited, while the same percentage in an analysis section might warrant closer examination.

Modern similarity detection tools are designed to support the writing process, helping authors identify areas that may need additional citation or original development before final submission.', 'resources', 'Content explaining similarity in academic documents'),
('resources_cta_title', 'Ready to Check Your Document?', 'resources', 'CTA section title'),
('resources_cta_subtitle', 'Apply what you''ve learned and verify your document''s originality with Plagaiscans.', 'resources', 'CTA section subtitle')
ON CONFLICT (content_key) DO NOTHING;
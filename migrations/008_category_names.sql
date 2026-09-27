-- plain names for the worker's four categories, matching CATEGORIES in data-engine/worker.py.
-- safe to run more than once.

UPDATE repositories SET category = CASE category
    WHEN 'AI & Machine Learning'   THEN 'Machine learning'
    WHEN 'Blue Chip Systems'       THEN 'Rust and C++'
    WHEN 'Web Frameworks'          THEN 'TypeScript and JavaScript'
    WHEN 'Hot IPOs (Last 30 Days)' THEN 'New repos'
END
WHERE category IN ('AI & Machine Learning', 'Blue Chip Systems', 'Web Frameworks', 'Hot IPOs (Last 30 Days)');

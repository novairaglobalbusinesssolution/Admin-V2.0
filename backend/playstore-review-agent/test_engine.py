from review_engine import ReviewExtractionJob

print("Testing ReviewExtractionJob initialization...")
job = ReviewExtractionJob(
    job_id="test_001",
    package_id="com.spotify.music",
    start_date="2026-09-01",
    end_date="2026-09-13",
    country="in",
    max_reviews=50
)

results = job.run()
print(f"Extraction finished. Extracted {len(results)} reviews.")
if results:
    print("Sample Review:", results[0])

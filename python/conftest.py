"""Selenium + Applitools Eyes (Ultrafast Grid) fixtures.

In CI the workflow sets APPLITOOLS_BATCH_ID / APPLITOOLS_BATCH_NAME so every run
lands in one Eyes batch, and the session URLs printed at the end are what the
review agent starts from.
"""
import os

import pytest
from selenium import webdriver
from applitools.selenium import (
    BatchInfo,
    BrowserType,
    ChromeEmulationInfo,
    Configuration,
    DeviceName,
    Eyes,
    MatchLevel,
    RunnerOptions,
    ScreenOrientation,
    VisualGridRunner,
)

SITE_URL = os.environ.get("SITE_URL", "http://localhost:3001/wikipedia")


@pytest.fixture(scope="session")
def runner():
    runner = VisualGridRunner(RunnerOptions().test_concurrency(5))
    yield runner
    summary = runner.get_all_test_results(False)
    urls = []
    for container in summary:
        results = container.test_results
        if results is not None:
            urls.append(results.url)
            print(f"\nEyes results: {results.name} [{results.status}] {results.url}")
    if urls:
        # .../app/batches/<batchId>/<sessionId>?accountId=... -> batch URL
        base, _, query = urls[0].partition("?")
        print(f"\nEyes batch: {base.rsplit('/', 1)[0]}?{query}")


@pytest.fixture(scope="session")
def eyes_config():
    batch = BatchInfo(os.environ.get("APPLITOOLS_BATCH_NAME", "Wikipedia (local)"))
    if os.environ.get("APPLITOOLS_BATCH_ID"):
        batch.id = os.environ["APPLITOOLS_BATCH_ID"]
    return (
        Configuration()
        .set_app_name("Wikipedia CI demo (Python)")
        .set_batch(batch)
        .set_match_level(MatchLevel.STRICT)
        .add_browser(1200, 800, BrowserType.CHROME)
        .add_browser(ChromeEmulationInfo(DeviceName.Galaxy_S25_Ultra, ScreenOrientation.PORTRAIT))
    )


@pytest.fixture
def driver():
    options = webdriver.ChromeOptions()
    options.add_argument("--headless=new")
    options.add_argument("--window-size=1200,800")
    driver = webdriver.Chrome(options=options)
    yield driver
    driver.quit()


@pytest.fixture
def eyes(runner, eyes_config, driver, request):
    eyes = Eyes(runner)
    eyes.set_configuration(eyes_config)
    eyes.open(driver, test_name=request.node.get_closest_marker("eyes_test").args[0])
    yield eyes
    # Differences don't fail the test; the review agent decides.
    eyes.close_async()

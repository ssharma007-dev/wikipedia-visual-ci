import pytest
from selenium.webdriver.common.by import By
from applitools.selenium import Target

from conftest import SITE_URL


@pytest.mark.eyes_test("Portal page")
def test_portal(driver, eyes):
    driver.get(SITE_URL)
    eyes.check("Portal", Target.window().fully())


@pytest.mark.eyes_test('Search for "functional testing"')
def test_search_functional_testing(driver, eyes):
    driver.get(SITE_URL)

    driver.find_element(By.ID, "searchInput").send_keys("functional testing")
    driver.find_element(By.CSS_SELECTOR, 'button[type="submit"]').click()

    eyes.check("Functional testing page", Target.window().fully())

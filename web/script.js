// Load the numbers.json file dynamically and populate the country select options
fetch('numbers.json')
  .then(response => response.json())
  .then(countries => {
    const countrySelect = document.getElementById('countrySelect');
    countries.forEach(country => {
      const option = document.createElement('option');
      option.value = country.code;
      option.textContent = `${country.name} (+${country.dial_code})`;
      option.dataset.flag = country.flag; // Assuming 'flag' is a URL or base64 string in the JSON
      countrySelect.appendChild(option);
    });
  })
  .catch(error => console.error('Error loading country data:', error));

// Display the selected country's flag and name above the phone input
const countrySelect = document.getElementById('countrySelect');
const selectedCountryDisplay = document.getElementById('selectedCountry');

countrySelect.addEventListener('change', () => {
  const selectedOption = countrySelect.options[countrySelect.selectedIndex];
  const countryName = selectedOption.textContent;
  const flagUrl = selectedOption.dataset.flag;

  // Update the display with the flag and country name
  selectedCountryDisplay.innerHTML = `<img src="${flagUrl}" alt="Flag"> <span>${countryName}</span>`;
});

// Auto-format phone number as user types
const phoneNumberInput = document.getElementById('phoneNumber');

phoneNumberInput.addEventListener('input', () => {
  let phoneValue = phoneNumberInput.value.replace(/\D/g, ''); // Remove non-numeric characters
  if (phoneValue.length > 3) {
    phoneValue = `${phoneValue.slice(0, 3)}-${phoneValue.slice(3)}`;
  }
  if (phoneValue.length > 7) {
    phoneValue = `${phoneValue.slice(0, 7)}-${phoneValue.slice(7)}`;
  }
  phoneNumberInput.value = phoneValue;
});

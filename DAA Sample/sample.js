const defectData = [
    ['Potholes', 3],
    ['Alligator Cracks', 3],
    ['Major Scaling', 30],
    ['Shoving and Corrugation', 10],
    ['Pumping and Depression', 30],
    ['No/Faded Road Markings', 15],
    ['Defects on Shoulders', 7],
    ['Lush Vegetation', 3],
    ['Clogged Drains', 3],
    ['Open Manhole', 10],
    ['No/Inadequate Sealant in Joints', 3],
    ['Cracks', 3],
    ['Raveling', 7],
    ['Unmaintained Signages and Road Markers', 15],
    ['Unmaintained Bridges', 15],
    ['Unmaintained Guardrails', 15],
  ];

  const responseTimeToScore = {
    3: 20,
    7: 40,
    10: 60,
    15: 80,
    30: 100
  };

  const roadRatingToScore = {
    1: 25,
    2: 50,
    3: 75,
    4: 100
  };

  const roadClassToScore = {
    'National': 100,
    'Municipal': 75,
    'Baranggay': 50,
    'Bypass': 25
  };

  // Populate checkbox dropdown
  const container = document.getElementById('checkboxContainer');
  defectData.forEach(([name, time]) => {
    const label = document.createElement('label');
    label.innerHTML = `<input type="checkbox" data-name="${name}" data-time="${time}"> ${name} (RT: ${time}d)`;
    container.appendChild(label);
  });

  // Dropdown open/close logic
  function toggleDropdown() {
    document.getElementById('defectDropdown').classList.toggle('open');
  }

  document.addEventListener('click', function (event) {
    const dropdown = document.getElementById('defectDropdown');
    if (!dropdown.contains(event.target)) {
      dropdown.classList.remove('open');
    }
  });

  // Submission handler
  function submitForm() {
    const roadName = document.getElementById('roadName').value.trim();
    const roadRating = parseInt(document.getElementById('roadRating').value);
    const roadClass = document.getElementById('roadClass').value;

    const ratingScore = roadRatingToScore[roadRating] || 'N/A';
    const classScore = roadClassToScore[roadClass] || 'N/A';

    const selected = [];
    const checkboxes = document.querySelectorAll('#checkboxContainer input[type="checkbox"]');
    checkboxes.forEach(cb => {
      if (cb.checked) {
        const name = cb.getAttribute('data-name');
        const time = parseInt(cb.getAttribute('data-time'));
        const score = responseTimeToScore[time];
        selected.push({ name, responseTime: time, score });
      }
    });

    let output = `Road Name: ${roadName || 'N/A'}\n`;
    output += `Road Rating: ${roadRating || 'N/A'} (Score: ${ratingScore})\n`;
    output += `Road Classification: ${roadClass || 'N/A'} (Score: ${classScore})\n\n`;

    if (selected.length === 0) {
      output += "No road defects selected.";
    } else {
      output += "Selected Road Defects:\n";
      selected.forEach(({ name, responseTime, score }) => {
        output += `- ${name} | Response Time: ${responseTime} days | Score: ${score}\n`;
      });
    }

    document.getElementById('output').textContent = output;
  }
// Debounce function to delay search calls
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Mock Smart Alerts Evaluator
// In a real app, this would deeply check contraindications against patient conditions
export function evaluatePrescriptionSafety(medicines, patientConditions) {
  let alertLevel = 'safe'; // safe, warning, critical
  let message = '';

  const medNames = medicines.map(m => m.name.toLowerCase());
  
  // Fake Rules for demonstration:
  // Rule 1: Paracetamol + Ibuprofen = Warning (redundant NSAID/analgesic)
  if (medNames.includes('paracetamol') && medNames.includes('ibuprofen')) {
    alertLevel = 'warning';
    message = 'Warning: Co-administration of Paracetamol and Ibuprofen may increase risk of side effects.';
  }

  // Rule 2: Patient has 'asthma' and we prescribe 'beta blocker'
  // using a dummy check for "olol" suffix (like propranolol)
  if (patientConditions.toLowerCase().includes('asthma') && medNames.some(m => m.endsWith('olol'))) {
    alertLevel = 'critical';
    message = 'Critical Contraindication: Beta-blockers are contraindicated in patients with Asthma.';
  }

  // Rule 3: High dosage warning (dummy logic if dosage is above typical)
  const highDose = medicines.find(m => m.dosage === '1000mg');
  if (highDose && alertLevel !== 'critical') {
    alertLevel = 'warning';
    message = `Warning: High dosage detected for ${highDose.name}. Verify patient tolerance.`;
  }

  return { alertLevel, message };
}

// Generate Print / PDF Layout
export function printPrescription() {
  window.print(); // Using browser's native print engine (coupled with print.css) is highly robust for web apps
}

// Generate WhatsApp Share Message
export function shareViaWhatsApp(patientPhone, patientName, medicines) {
  if (!patientPhone) {
    alert('Please provide a patient phone number to share.');
    return;
  }
  
  let msg = `Hello ${patientName},\nHere is your prescription from Auooshadh Clinic:\n\n`;
  medicines.forEach(m => {
    msg += `• ${m.name}: ${m.dosage} - ${m.frequency} for ${m.duration}\n`;
  });
  msg += `\nPlease take your medicines on time. Get well soon!\n- Dr. Auooshadh`;

  const encodedMsg = encodeURIComponent(msg);
  const waUrl = `https://wa.me/${patientPhone}?text=${encodedMsg}`;
  window.open(waUrl, '_blank');
}

document.getElementById("uploadForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const file = document.getElementById("image").files[0];
  const formData = new FormData();
  formData.append("image", file);

  const res = await fetch("/predict", { method: "POST", body: formData });
  const data = await res.json();

  document.getElementById("result").innerHTML = `
    <p><strong>Prediction:</strong> ${data.result.label}</p>
    <p><strong>Confidence:</strong> ${data.result.confidence}</p>
    <img src="${data.s3Url}" width="300"/>
  `;
});

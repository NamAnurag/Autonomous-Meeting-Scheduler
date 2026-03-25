import streamlit as st
import requests

st.title("AI Meeting Agent")

query = st.text_input("Enter your query:")

if st.button("Run Agent"):

    if query:
        response = requests.get(f"http://127.0.0.1:8000/agent?query={query}")
        data = response.json()

        if data.get("status") == "success":
            result = data["result"]

            st.success("✅ Meeting Scheduled Successfully")

            # ✅ Correct placement
            st.write("📌 Suggested Slot:", result.get("slot"))

            emails = result.get("emails", [])
            st.write("📧 Emails Analyzed:", len(emails))

            meeting_count = sum(
                1 for e in emails if e["details"]["is_meeting"] == "YES"
            )
            st.write("📅 Meeting Requests Found:", meeting_count)

            st.markdown("### 📨 Generated Reply")
            st.code(result.get("reply"), language="text")

        else:
            st.error("❌ Error occurred")
            st.write(data)

    else:
        st.warning("⚠️ Please enter a query")
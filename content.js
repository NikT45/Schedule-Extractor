

function extractTimesFromHTML(htmlSnippet) {
    const timeRegex = /\<span\>\s*(\d{2})\<\/span\>:\<span\>(\d{2})\<\/span\>\s*(AM|PM)/g;
    let match;
    const times = [];

    while ((match = timeRegex.exec(htmlSnippet)) !== null) {
        const hours = match[1];
        const minutes = match[2];
        const period = match[3];
        times.push(`${hours}${minutes}${period}`);
    }

    return times;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "downloadData") {
        // Call your function to scrape data

        const courses = document.querySelectorAll(".listViewWrapper");
        console.log(courses);
        events = Array.from(courses).map((course) => {
            // Extract only the text outside the span
            const title = course.querySelector(".section-details-link").innerText.trim();
            const timeHtml = course.querySelector(".listViewMeetingInformation span:nth-of-type(3)").innerHTML;
            const times = extractTimesFromHTML(timeHtml);
            const dateRange = course.querySelector(".meetingTimes").innerText.trim();
            const [startDate, endDate] = dateRange.split(" -- ").map(date => date.trim());

            // Extract building and room from the current course
            const locationText = course.querySelector(".listViewMeetingInformation").innerText;

            // Use regular expressions to extract the building and room
            const buildingMatch = locationText.match(/Building:\s*([^\s].*?)\s*Room:/);
            const roomMatch = locationText.match(/Room:\s*([\w-]+)/);

            // Extract and trim the values
            const building = buildingMatch ? buildingMatch[1].trim() : null;
            const room = roomMatch ? roomMatch[1].trim() : null;

            // Extract highlighted class days
            const highlightedDaysElements = course.querySelectorAll("ul li.ui-state-highlight");
            const classDays = Array.from(highlightedDaysElements).map((dayElement) =>
                dayElement.getAttribute("data-name")
            );

            return { title, times, startDate, endDate, building, room ,classDays};
        });

        console.log("Extracted Events:", events);

        // Send data back to the popup
        sendResponse({ success: true, data: events });

        const icsContent = generateICS(events);

        // Trigger the download
        const blob = new Blob([icsContent], { type: "text/calendar" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "schedule.ics";
        link.click();
    }
    return true; // Keep the message channel open for async responses
});

function generateICS(events) {
    let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Your App//EN\n";

    // Map days of the week to numbers for alignment with JavaScript Date
    const dayToWeekdayOffset = {
        Sunday: 0,
        Monday: 1,
        Tuesday: 2,
        Wednesday: 3,
        Thursday: 4,
        Friday: 5,
        Saturday: 6,
    };

    events.forEach((event, index) => {
        try {
            // Parse event start and end times
            const [startTime, endTime] = event.times;

            // Convert times to hours and minutes
            const [startHour, startMinute] = parseTime(startTime);
            const [endHour, endMinute] = parseTime(endTime);

            // Set up recurrence end date
            const recurrenceEndDate = new Date(event.endDate);

            // i don't think i need this anymore given the updated data set
            //recurrenceEndDate.setDate(recurrenceEndDate.getDate() + 1);

            // Generate events for each class day
            event.classDays.forEach((classDay) => {
                // Align the start date to the specified class day
                const startDateObj = new Date(event.startDate);
                const targetDay = dayToWeekdayOffset[classDay];

                if (startDateObj.getDay() !== targetDay) {
                    const daysUntilEvent =
                        (targetDay - startDateObj.getDay() + 7) % 7;
                    startDateObj.setDate(startDateObj.getDate() + daysUntilEvent);
                }

                // Set the start and end time for the event
                const eventStart = setDateTime(startDateObj, startHour, startMinute);
                const eventEnd = setDateTime(startDateObj, endHour, endMinute);

                // Add the event to the calendar
                icsContent += `BEGIN:VEVENT\n`;
                icsContent += `UID:event-${index}-${classDay}@yourapp.com\n`;
                icsContent += `DTSTAMP:${formatICSDate(new Date())}\n`;
                icsContent += `DTSTART:${formatICSDate(eventStart)}\n`;
                icsContent += `DTEND:${formatICSDate(eventEnd)}\n`;
                icsContent += `SUMMARY:${event.title}\n`;
                icsContent += `LOCATION:${event.building + ' '+ event.room}\n`;
                icsContent += `RRULE:FREQ=WEEKLY;UNTIL=${formatICSDate(recurrenceEndDate)}\n`;
                icsContent += `END:VEVENT\n`;
            });
        } catch (error) {
            console.error(`Error processing event: ${event.title || "Unknown Title"}`, error);
        }
    });

    icsContent += "END:VCALENDAR";
    return icsContent;
}

// Helper function to parse time (e.g., "1000AM" or "0345PM") into hours and minutes
function parseTime(time) {
    const match = time.match(/(\d{1,2})(\d{2})(AM|PM)/);
    if (!match) {
        throw new Error(`Invalid time format: ${time}`);
    }
    let [_, hours, minutes, period] = match;
    hours = parseInt(hours, 10);
    minutes = parseInt(minutes, 10);
    if (period === "PM" && hours !== 12) {
        hours += 12;
    } else if (period === "AM" && hours === 12) {
        hours = 0;
    }
    return [hours, minutes];
}

// Helper function to set the time on a date object
function setDateTime(date, hours, minutes) {
    const newDate = new Date(date);
    newDate.setHours(hours, minutes, 0, 0);
    return newDate;
}

// Helper function to format dates in ICS format
function formatICSDate(date) {
    return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

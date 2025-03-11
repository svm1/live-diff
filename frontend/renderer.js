const { ipcRenderer } = require('electron');
const DEBUG_MODE = true;  // Set to false to disable automatic file selection

if (DEBUG_MODE) {
    window.selectedFile1 = "/Users/svm/Music/Ableton/Live Recordings/projects/stuck_on_you Project/test.als";
    window.selectedFile2 = "/Users/svm/Music/Ableton/Live Recordings/projects/stuck_on_you Project/test4.als";
    document.getElementById('file-path-1').textContent = window.selectedFile1;
    document.getElementById('file-path-2').textContent = window.selectedFile2;
}

document.getElementById('select-file-1').addEventListener('click', async () => {
    if (DEBUG_MODE) return;  // Skip manual selection in debug mode
    
    console.log('clicked file1');
    const filePath = await ipcRenderer.invoke('select-file', 1);
    if (filePath) {
        document.getElementById('file-path-1').textContent = filePath;
        window.selectedFile1 = filePath;
    }
});

document.getElementById('select-file-2').addEventListener('click', async () => {
    if (DEBUG_MODE) return;  // Skip manual selection in debug mode

    console.log('clicked file2');
    const filePath = await ipcRenderer.invoke('select-file', 2);
    if (filePath) {
        document.getElementById('file-path-2').textContent = filePath;
        window.selectedFile2 = filePath;
    }
});

document.getElementById('run-diff').addEventListener('click', async () => {
    console.log('diff click')
    if (!window.selectedFile1 || !window.selectedFile2) {
        document.getElementById('diff-output').textContent = 'Please select both ALS files before running the diff.';
        return;
    }
    
    document.getElementById('diff-output').textContent = 'Running diff...';
    try {
        const diffResult = await ipcRenderer.invoke('run-diff', window.selectedFile1, window.selectedFile2);

        // for displaying OG Python console output
        // document.getElementById('diff-output').textContent = diffResult;

        console.log('pre visualize:', diffResult);
        console.log('typeof diffResult:', typeof diffResult);

        if (!diffResult) {
            throw new Error("diffResult is null or undefined");
        }

        visualizeDiff(diffResult);
    } catch (error) {
        document.getElementById('diff-output').textContent = 'Error running diff: ' + error.message;
    }
});

function visualizeDiff(diffData) {
    console.log("VISUALIZE DIFF", diffData);
    
    const container = document.getElementById('diff-output');
    container.innerHTML = ''; // Clear previous output

    Object.entries(diffData.tracks).forEach(([trackName, trackDiff]) => {
        console.log(`🎵 Processing track: ${trackName}`, trackDiff);

        if (!trackDiff) {
            console.warn(`Skipping track ${trackName} - trackDiff is undefined`);
            return;
        }

        // Ensure all clip/note change fields are valid arrays
        const addedClips = Array.isArray(trackDiff.added_clips) ? trackDiff.added_clips : [];
        const removedClips = Array.isArray(trackDiff.removed_clips) ? trackDiff.removed_clips : [];
        const unchangedClips = Array.isArray(trackDiff.unchanged_clips) ? trackDiff.unchanged_clips : [];
        const noteChanges = Array.isArray(trackDiff.note_changes) ? trackDiff.note_changes : [];

        // Create a container for the track
        const trackContainer = document.createElement('div');
        trackContainer.classList.add('track');

        // Track Title
        const trackTitle = document.createElement('h3');
        trackTitle.textContent = trackName;
        trackContainer.appendChild(trackTitle);

        // Clip Timeline
        const clipContainer = document.createElement('div');
        clipContainer.classList.add('clip-timeline');

        function createClipElement(clip, type, index) {
            const clipElement = document.createElement('div');
            clipElement.classList.add('clip');
            clipElement.dataset.index = index;

            if (!Array.isArray(clip) || clip.length < 2) {
                console.warn(`Invalid clip data for ${trackName}:`, clip);
                return;
            }

            // Set width based on duration (basic scaling)
            const duration = clip[1]; // clip[1] = duration in beats
            clipElement.style.width = `${duration * 10}px`; // Scale factor
            clipElement.style.height = `80px`; // Increased height to fit notes
            clipElement.style.position = "relative"; // Needed for absolute note positioning

            // Set color
            if (type === "added") clipElement.style.backgroundColor = "green";
            if (type === "removed") clipElement.style.backgroundColor = "red";
            if (type === "unchanged") clipElement.style.backgroundColor = "gray";

            // Tooltip on hover
            clipElement.title = `Start: ${clip[0]} | Duration: ${clip[1]}`;
            return clipElement;
        }

        // Create a mapping of clips for note positioning
        let clipElements = [];

        // Render Added Clips
        addedClips.forEach((clip, i) => {
            const clipElement = createClipElement(clip, "added", i);
            if (clipElement) {
                clipElements.push({ clipElement, index: i });
                clipContainer.appendChild(clipElement);
            }
        });

        // Render Removed Clips
        removedClips.forEach((clip, i) => {
            const clipElement = createClipElement(clip, "removed", i);
            if (clipElement) {
                clipElements.push({ clipElement, index: i });
                clipContainer.appendChild(clipElement);
            }
        });

        // Render Unchanged Clips (important for note changes)
        unchangedClips.forEach((clip, i) => {
            const clipElement = createClipElement(clip, "unchanged", i);
            if (clipElement) {
                clipElements.push({ clipElement, index: i });
                clipContainer.appendChild(clipElement);
            }
        });

        // Note Placement Logic
        function createNoteElement(note, type) {
            const noteElement = document.createElement('div');
            noteElement.classList.add('note');

            if (!note || !note.bar || !note.note || !note.duration) {
                console.warn(`Invalid note data for ${trackName}:`, note);
                console.log(!note)
                console.log(!note.bar)
                console.log(!note.note)
                console.log(!note.duration)
                return null;
            }

            // Set width based on duration (basic scaling)
            const duration = note.duration;
            noteElement.style.width = `${duration * 10}px`;

            // Set vertical positioning based on MIDI pitch (simulate piano roll)
            const notePitch = note.note.replace(/\d/, ""); // Extract just the note name (C, D#, etc.)
            const noteIndex = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"].indexOf(notePitch);
            noteElement.style.height = "8px";
            noteElement.style.position = "absolute";
            noteElement.style.top = `${(11 - noteIndex) * 5}px`; // Higher notes appear above

            // Set horizontal position based on note start time
            const barValue = Array.isArray(note.bar) ? note.bar[0] : note.bar; // Extract bar value
            const beatValue = Array.isArray(note.bar) ? note.bar[1] : 0; // Extract beat value if available
            console.log(`🎯 Bar: ${barValue}, Beat: ${beatValue}`);
            noteElement.style.left = `${(barValue * 40) + (beatValue * 10)}px`;
            console.log(`old left: ${noteElement.style.left}`);

            // Set color based on type
            if (type === "added") noteElement.style.backgroundColor = "black";
            if (type === "removed") noteElement.style.backgroundColor = "white";
            if (type === "modified") noteElement.style.backgroundColor = "yellow";

            // Tooltip with note details
            noteElement.title = `${note.note} | Start: ${barValue}.${beatValue}, Duration: ${note.duration}, Vel: ${note.velocity}`;
            return noteElement;
        }

        // Attach Notes to Clips
        function attachNotesToClips(clipElements, noteChanges) {
            noteChanges.forEach(change => {
                console.log(`🎹 Processing note changes for clip ${change.clip_index}:`, change);
        
                let clipElement = clipElements.find(clip => clip.index === change.clip_index);
                if (!clipElement || !clipElement.clipElement) {
                    console.warn(`🚨 No matching clip found for clip_index ${change.clip_index}`);
                    return;
                }
        
                change.added_notes?.forEach(note => {
                    console.log(`➕ Adding note to clip ${change.clip_index}:`, note);
                    const noteElement = createNoteElement(note, "added");
                    if (noteElement) {

                        const barValue = Array.isArray(note.bar) ? note.bar[0] : note.bar; // Extract bar value
                        const beatValue = Array.isArray(note.bar) ? note.bar[1] : 0; // Extract beat value if available

                        const clipStart = clipElement.offsetLeft; // Get the starting position of the clip
                        const barWidth = 30; // Adjust based on how wide each bar should be
                        const beatWidth = barWidth / 4; // Assuming 4 beats per bar

                        console.log(`CLIP START: ${clipStart}`);

                        const noteLeft = (barValue * barWidth) + (beatValue * beatWidth);
                        noteElement.style.left = `${clipStart + noteLeft}px`;
                        console.log(`new left: ${noteElement.style.left}`);

                        clipElement.clipElement.appendChild(noteElement);
                        
                        console.log(`✅ Successfully added note to clip ${change.clip_index}`);
                    } else {
                        console.warn(`❌ Failed to create note element for`, note);
                    }
                });
        
                change.removed_notes?.forEach(note => {
                    console.log(`➖ Removing note from clip ${change.clip_index}:`, note);
                    const noteElement = createNoteElement(note, "removed");
                    if (noteElement) {

                        const barValue = Array.isArray(note.bar) ? note.bar[0] : note.bar; // Extract bar value
                        const beatValue = Array.isArray(note.bar) ? note.bar[1] : 0; // Extract beat value if available

                        const clipStart = clipElement.offsetLeft; // Get the starting position of the clip
                        const barWidth = 30; // Adjust based on how wide each bar should be
                        const beatWidth = barWidth / 4; // Assuming 4 beats per bar

                        console.log(`CLIP START: ${clipStart}`);

                        const noteLeft = (barValue * barWidth) + (beatValue * beatWidth);
                        noteElement.style.left = `${clipStart + noteLeft}px`;
                        console.log(`new left: ${noteElement.style.left}`);
                        
                        clipElement.clipElement.appendChild(noteElement);
                        console.log(`✅ Successfully removed note from clip ${change.clip_index}`);
                    } else {
                        console.warn(`❌ Failed to create note element for`, note);
                    }
                });
            });
        }        
        

        // Attach note changes to the correct clips
        attachNotesToClips(clipElements, noteChanges);

        // Append the clip container
        trackContainer.appendChild(clipContainer);
        container.appendChild(trackContainer);
    });
}



// function visualizeDiff(diffData) {
//     console.log("VISUALIZE DIFF", diffData);
    
//     const container = document.getElementById('diff-output');
//     container.innerHTML = ''; // Clear previous output

//     Object.entries(diffData.tracks).forEach(([trackName, trackDiff]) => {
//         console.log(`🎵 Processing track: ${trackName}`, trackDiff);

//         if (!trackDiff) {
//             console.warn(`Skipping track ${trackName} - trackDiff is undefined`);
//             return;
//         }

//         // Ensure added_clips, removed_clips, and note_changes are valid
//         const addedClips = Array.isArray(trackDiff.added_clips) ? trackDiff.added_clips : [];
//         const removedClips = Array.isArray(trackDiff.removed_clips) ? trackDiff.removed_clips : [];
//         const noteChanges = Array.isArray(trackDiff.note_changes) ? trackDiff.note_changes : [];
//         const unchangedClips = Array.isArray(trackDiff.unchanged_clips) ? trackDiff.unchanged_clips : [];

//         // Create a container for the track
//         const trackContainer = document.createElement('div');
//         trackContainer.classList.add('track');

//         // Track Title
//         const trackTitle = document.createElement('h3');
//         trackTitle.textContent = trackName;
//         trackContainer.appendChild(trackTitle);

//         // Clip Timeline
//         const clipContainer = document.createElement('div');
//         clipContainer.classList.add('clip-timeline');

//         function createClipElement(clip, type) {
//             const clipElement = document.createElement('div');
//             clipElement.classList.add('clip');

//             if (!Array.isArray(clip) || clip.length < 2) {
//                 console.warn(`Invalid clip data for ${trackName}:`, clip);
//                 return null;
//             }

//             // Set width based on duration (basic scaling)
//             const duration = clip[1]; // clip[1] = duration in beats
//             clipElement.style.width = `${duration * 10}px`; // Scale factor

//             // Set color
//             if (type === "added") clipElement.style.backgroundColor = "green";
//             if (type === "removed") clipElement.style.backgroundColor = "red";

//             // Tooltip on hover
//             clipElement.title = `Start: ${clip[0]} | Duration: ${clip[1]}`;
//             return clipElement;
//         }

//         unchangedClips.forEach(clip => {
//             const clipElement = createClipElement(clip, "unchanged");
//             if (clipElement) {
//                 clipElement.style.backgroundColor = "gray"; // Color for unchanged clips
//                 clipContainer.appendChild(clipElement);
//             }
//         });

//         // Render Added Clips
//         addedClips.forEach(clip => {
//             const clipElement = createClipElement(clip, "added");
//             if (clipElement) clipContainer.appendChild(clipElement);
//         });

//         // Render Removed Clips
//         removedClips.forEach(clip => {
//             const clipElement = createClipElement(clip, "removed");
//             if (clipElement) clipContainer.appendChild(clipElement);
//         });

//         // Note-Level Timeline
//         console.log(`🔍 Note Changes for ${trackName}:`, noteChanges);

//         const noteContainer = document.createElement('div');
//         noteContainer.classList.add('note-timeline');

//         function createNoteElement(note, type) {
//             const noteElement = document.createElement('div');
//             noteElement.classList.add('note');
        
//             // Adjust this to handle the nested structure correctly
//             const bar = Array.isArray(note.bar) ? note.bar.join('.') : note.bar; 

//             console.log('NOTE')
//             console.log(note)
//             console.log(bar)
        
//             if (!note || !bar || !note.note || !note.duration || !note.velocity) {
//                 console.warn(`Invalid note data:`, note);
//                 // console.log(!note)
//                 // console.log(!bar)
//                 // console.log(!note.note)
//                 // console.log(!note.duration)
//                 // console.log(!note.velocity)
//                 return;
//             }
        
//             // Set width based on duration (basic scaling)
//             const duration = note.duration || 1;  // Default to 1 if missing
//             noteElement.style.width = `${duration * 10}px`;
        
//             // Set color based on type
//             if (type === "added") noteElement.style.backgroundColor = "lightgreen";
//             if (type === "removed") noteElement.style.backgroundColor = "lightcoral";
//             if (type === "modified") noteElement.style.backgroundColor = "yellow";
        
//             // Tooltip with note details
//             noteElement.title = `${note.note} | Bar: ${bar}, Duration: ${duration}, Velocity: ${note.velocity || "N/A"}`;
//             return noteElement;
//         }

//         // Ensure we always render clips if note changes exist
//         if (noteChanges.length > 0 || addedClips.length > 0 || removedClips.length > 0) {
//             // Render Note Changes
//             // Process note changes at the clip level
//             noteChanges.forEach(clipChange => {
//                 console.log(`🎼 Processing Clip Index: ${clipChange.clip_index}`, clipChange);

//                 // Process Added Notes
//                 clipChange.added_notes.forEach(note => {
//                     const noteElement = createNoteElement(note, "added");
//                     if (noteElement) noteContainer.appendChild(noteElement);
//                 });

//                 // Process Removed Notes
//                 clipChange.removed_notes.forEach(note => {
//                     const noteElement = createNoteElement(note, "removed");
//                     if (noteElement) noteContainer.appendChild(noteElement);
//                 });

//                 // Process Modified Notes
//                 // clipChange.modified_notes.forEach(([oldNote, newNote]) => {
//                 //     const noteElement = createNoteElement(newNote, "modified");  // Show the new version
//                 //     if (noteElement) noteContainer.appendChild(noteElement);
//                 // });
//             });


//             // Append both containers
//             trackContainer.appendChild(clipContainer);
//             trackContainer.appendChild(noteContainer);
//             container.appendChild(trackContainer);
//         }
//     });
// }

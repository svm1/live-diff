import xml.etree.ElementTree as ET

def convert_to_bars_beats(time):
    """Convert Ableton's beat-based Time value into bars & beats (4/4 time)."""
    bar = int(time // 4) + 1  # Bar number (Ableton bars start at 1)
    beat = (time % 4) + 1  # Beat within the bar
    return bar, beat

def extract_midi_note_times(xml_file):
    """Extracts note start times from an ALS file and converts them to bars/beats."""
    tree = ET.parse(xml_file)
    root = tree.getroot()
    clip_elem = root.find(".//MidiClip")  # Find first MIDI clip
    
    if clip_elem is None:
        print("No MIDI clips found in XML.")
        return
    
    notes = []
    
    for keytrack in clip_elem.findall(".//KeyTrack"):
        for note in keytrack.findall(".//MidiNoteEvent"):
            note_time = float(note.get("Time"))  # Raw XML Time
            note_duration = float(note.get("Duration"))
            note_velocity = int(note.get("Velocity"))
            note_id = int(note.get("NoteId"))

            # Convert to bars & beats
            bar, beat = convert_to_bars_beats(note_time)

            notes.append((note_time, bar, beat, note_duration, note_velocity, note_id))
    
    print("Converted MIDI Note Times:")
    print("Time  | Bar | Beat | Duration | Velocity | Note ID")
    print("-" * 50)
    for note in sorted(notes):
        print(f"{note[0]:<5} | {note[1]:<3} | {note[2]:<4} | {note[3]:<8} | {note[4]:<7} | {note[5]:<6}")
    
    return notes

# Run the test on the extracted XML file
xml_file = "timing_test_96bpm_unpacked.xml"  # Replace with your extracted XML
extract_midi_note_times(xml_file)

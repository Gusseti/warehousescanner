import json
import re
import os

def convert_barcodes_to_json():
    # Ask for input file
    input_file = input("barcodes_ny.txt")
    
    # Set output file name with .json extension
    output_file = os.path.splitext(input_file)[0] + ".json"
    
    # Dictionary to store barcode mappings
    barcode_mapping = {}
    
    # Check if file exists
    if not os.path.exists(input_file):
        print(f"Error: Could not find the file '{input_file}'")
        return None
    
    # Read the input file
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            # Skip header if it exists (Items No. GTIN)
            lines = f.readlines()
            if lines and ("Items No." in lines[0] or "GTIN" in lines[0]):
                lines = lines[1:]
            
            # Process each line
            for line in lines:
                # Skip empty lines
                if not line.strip():
                    continue
                    
                # Strip whitespace and split by tab or multiple spaces
                parts = re.split(r'\t+|\s{2,}', line.strip())
                
                # Check if we have at least 2 parts
                if len(parts) >= 2:
                    item_no = parts[0].strip()
                    barcode = parts[1].strip()
                    
                    # Add to dictionary if both values are present
                    if item_no and barcode:
                        barcode_mapping[barcode] = item_no
        
        # Write to JSON file
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(barcode_mapping, f, indent=4)
        
        print(f"Converted {len(barcode_mapping)} barcodes to JSON in {output_file}")
        return barcode_mapping
    
    except Exception as e:
        print(f"Error: {e}")
        return None

if __name__ == "__main__":
    convert_barcodes_to_json()
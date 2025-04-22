import csv
import json
import os

def convert_csv_to_barcode_json(input_file="Regneark uten navn - Ark 1.csv", output_file="barcodes.json"):
    """
    Converts CSV file with product information to a barcode JSON mapping file.
    
    Expected CSV format:
    Varenr.,Beskrivelse,GTIN
    
    Output JSON format:
    {
        "barcode1": {
            "id": "product_id1",
            "description": "Product description 1"
        },
        "barcode2": {
            "id": "product_id2",
            "description": "Product description 2"
        },
        ...
    }
    """
    # Dictionary to store barcode mappings (GTIN -> {id, description})
    barcode_mapping = {}
    
    # Check if file exists
    if not os.path.exists(input_file):
        print(f"Error: Could not find the file '{input_file}'")
        return None
    
    # Read the input file
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            # Create CSV reader
            csv_reader = csv.reader(f)
            
            # Skip header row
            header = next(csv_reader)
            
            # Find column indices
            try:
                varenr_idx = header.index("Varenr.")
                beskrivelse_idx = header.index("Beskrivelse")
                gtin_idx = header.index("GTIN")
            except ValueError:
                print("Error: CSV file must contain 'Varenr.', 'Beskrivelse', and 'GTIN' columns")
                return None
            
            # Process each row
            for row in csv_reader:
                if len(row) > max(varenr_idx, beskrivelse_idx, gtin_idx):
                    varenr = row[varenr_idx].strip()
                    beskrivelse = row[beskrivelse_idx].strip()
                    gtin = row[gtin_idx].strip()
                    
                    # Add to dictionary if both values are present
                    if varenr and gtin and gtin != "0":
                        # Convert GTIN to string to ensure it's a valid JSON key
                        barcode_mapping[str(gtin)] = {
                            "id": varenr,
                            "description": beskrivelse
                        }
        
        # Write to JSON file
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(barcode_mapping, f, indent=4, ensure_ascii=False)
        
        print(f"Converted {len(barcode_mapping)} barcodes to JSON in {output_file}")
        return barcode_mapping
    
    except Exception as e:
        print(f"Error: {e}")
        return None

if __name__ == "__main__":
    convert_csv_to_barcode_json()
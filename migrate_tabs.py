#!/usr/bin/env python3
"""
Script to migrate PRECIOS and MASTER tabs from Administration.html to marketplace.html
"""

import re

def read_file(filepath):
    """Read file content"""
    with open(filepath, 'r', encoding='utf-8') as f:
        return f.read()

def write_file(filepath, content):
    """Write content to file"""
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

def extract_section(content, start_pattern, end_pattern, include_start=True, include_end=True):
    """Extract a section of content between two patterns"""
    start_match = re.search(start_pattern, content, re.DOTALL | re.MULTILINE)
    if not start_match:
        return None, None, None

    start_pos = start_match.start() if include_start else start_match.end()

    # Find the end pattern after the start position
    end_match = re.search(end_pattern, content[start_match.end():], re.DOTALL | re.MULTILINE)
    if not end_match:
        return None, None, None

    end_pos = start_match.end() + (end_match.end() if include_end else end_match.start())

    return content[start_pos:end_pos], start_pos, end_pos

def main():
    admin_file = r'E:\git\carrito-api\Administration.html'
    marketplace_file = r'E:\git\carrito-api\marketplace.html'

    print("Reading files...")
    admin_content = read_file(admin_file)
    marketplace_content = read_file(marketplace_file)

    # Step 1: Extract PRECIOS tab button from Administration.html (lines 1865-1873)
    precios_tab_btn = '''            <button class="mdc-tab" role="tab" aria-selected="false" tabindex="-1" data-tab="precios" data-admin-only="true">
              <span class="mdc-tab__content">
                <span class="mdc-tab__text-label">PRECIOS</span>
              </span>
              <span class="mdc-tab-indicator">
                <span class="mdc-tab-indicator__content mdc-tab-indicator__content--underline"></span>
              </span>
              <span class="mdc-tab__ripple"></span>
            </button>'''

    # Step 2: Extract MASTER tab button from Administration.html (lines 1892-1900)
    master_tab_btn = '''            <button class="mdc-tab" role="tab" aria-selected="false" tabindex="-1" data-tab="master" data-admin-only="true">
              <span class="mdc-tab__content">
                <span class="mdc-tab__text-label">MASTER</span>
              </span>
              <span class="mdc-tab-indicator">
                <span class="mdc-tab-indicator__content mdc-tab-indicator__content--underline"></span>
              </span>
              <span class="mdc-tab__ripple"></span>
            </button>'''

    # Step 3: Extract PRECIOS content (from line 1927 to before line 1981)
    print("Extracting PRECIOS content...")
    precios_content_match = re.search(
        r'(<div id="precios-content" class="tab-content">.*?)</div>\s*<div id="clientes-content"',
        admin_content,
        re.DOTALL
    )

    if not precios_content_match:
        print("ERROR: Could not find PRECIOS content")
        return

    precios_content = precios_content_match.group(1) + '    </div>\n'

    # Step 4: Extract MASTER content (from line 2119 to line 2266)
    print("Extracting MASTER content...")
    master_content_match = re.search(
        r'(<div id="master-content" class="tab-content" style="display: none;">.*?)</div>\s*</div>\s*<!-- Admisiones Content -->',
        admin_content,
        re.DOTALL
    )

    if not master_content_match:
        print("ERROR: Could not find MASTER content")
        return

    master_content = master_content_match.group(1) + '    </div>\n  </div>\n'

    # Step 5: Add tabs to marketplace.html after Samsung tab
    print("Adding tabs to marketplace.html...")
    marketplace_content = re.sub(
        r'(</button>\s*</div>\s*</div>\s*</div>\s*</div>)',
        precios_tab_btn + '\n' + master_tab_btn + '\n\\1',
        marketplace_content,
        count=1
    )

    # Step 6: Add content after the container div in marketplace.html
    # Find where to insert (after the toolbar section and before any existing content divs)
    insertion_point = marketplace_content.find('    <div class="toolbar">')
    if insertion_point > 0:
        # Find the end of toolbar section
        toolbar_end = marketplace_content.find('    </div>', insertion_point)
        if toolbar_end > 0:
            # Find the next section
            next_section = marketplace_content.find('\n\n', toolbar_end + 10)
            if next_section > 0:
                marketplace_content = (
                    marketplace_content[:next_section] +
                    '\n\n    <!-- PRECIOS TAB CONTENT (moved from Administration.html) -->\n' +
                    precios_content +
                    '\n    <!-- MASTER TAB CONTENT (moved from Administration.html) -->\n' +
                    master_content +
                    marketplace_content[next_section:]
                )

    # Step 7: Comment out tabs in Administration.html
    print("Commenting out tabs in Administration.html...")

    # Comment PRECIOS tab button
    admin_content = re.sub(
        r'(\s*<button class="mdc-tab mdc-tab--active" role="tab" aria-selected="true" tabindex="0" data-tab="precios">.*?</button>)',
        r'<!-- MOVIDO A marketplace.html\n\1\n            -->',
        admin_content,
        count=1,
        flags=re.DOTALL
    )

    # Comment MASTER tab button
    admin_content = re.sub(
        r'(\s*<button class="mdc-tab" role="tab" aria-selected="false" tabindex="-1" data-tab="master">.*?</button>)',
        r'<!-- MOVIDO A marketplace.html\n\1\n            -->',
        admin_content,
        count=1,
        flags=re.DOTALL
    )

    # Comment PRECIOS content
    admin_content = re.sub(
        r'(\s*<div id="precios-content" class="tab-content">.*?</div>)\s*(<div id="clientes-content")',
        r'<!-- MOVIDO A marketplace.html\n\1\n    -->\n\n    \2',
        admin_content,
        count=1,
        flags=re.DOTALL
    )

    # Comment MASTER content
    admin_content = re.sub(
        r'(\s*<div id="master-content" class="tab-content" style="display: none;">.*?</div>\s*</div>)\s*(<!-- Admisiones Content -->)',
        r'<!-- MOVIDO A marketplace.html\n\1\n  -->\n\n  \2',
        admin_content,
        count=1,
        flags=re.DOTALL
    )

    # Step 8: Write files back
    print("Writing files...")
    write_file(admin_file, admin_content)
    write_file(marketplace_file, marketplace_content)

    print("✅ Migration completed successfully!")
    print(f"  - PRECIOS tab button added to marketplace.html")
    print(f"  - MASTER tab button added to marketplace.html")
    print(f"  - PRECIOS content added to marketplace.html")
    print(f"  - MASTER content added to marketplace.html")
    print(f"  - Tabs commented out in Administration.html")

if __name__ == '__main__':
    main()

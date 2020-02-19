import sys

in_files = sys.argv[1:]

lines_seen = set()
for in_file in in_files:
    with open(in_file, "r") as f:
        # ignore two header lines
        next(f)
        next(f)
        for line in f:
            if line not in lines_seen: # not a duplicate
                sys.stdout.write(line)
                lines_seen.add(line)

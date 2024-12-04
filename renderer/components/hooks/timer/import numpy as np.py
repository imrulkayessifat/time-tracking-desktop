import matplotlib.pyplot as plt

# Data from the bar graph
colors = ["'Blue'", "'Red'", "'Yellow'"]
sizes = [8, 15, 7]

# Create the pie chart
plt.pie(sizes, labels=colors, autopct="%1.1f%%", startangle=140)

# Equal aspect ratio ensures that pie is drawn as a circle.
plt.axis("equal")

# Title
plt.title("Number of students by color")

# Show the plot
plt.show()
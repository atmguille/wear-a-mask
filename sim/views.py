from django.core.paginator import Paginator
from django.db import IntegrityError
from django.http import HttpResponseForbidden, HttpResponseRedirect
from django.shortcuts import render
from django.contrib.auth import authenticate, login, logout
from django.urls import reverse

from .models import User, Post
from .forms import PostForm

POSTS_PER_PAGE = 5


# Create your views here.
def index(request):
    return render(request, 'sim/simulation.html')


def forum(request):
    if request.method == "POST":
        page_number = 1  # Once new post is saved, return to first page
        new_post_form = PostForm(request.POST, instance=Post(owner=request.user))
        if new_post_form.is_valid():
            new_post_form.save()
        else:
            return HttpResponseForbidden("<h1>Post is not valid</h1>")

    else:
        try:
            page_number = request.GET["page"]
        except KeyError:
            page_number = 1

    posts = Post.objects.all().order_by('timestamp').reverse()
    paginator = Paginator(posts, POSTS_PER_PAGE)
    page_obj = paginator.get_page(page_number)

    return render(request, "sim/forum.html", {
        "new_post_form": PostForm(),
        "page_obj": page_obj
    })


def login_view(request):
    if request.method == "POST":

        # Attempt to sign user in
        username = request.POST["username"]
        password = request.POST["password"]
        user = authenticate(request, username=username, password=password)

        # Check if authentication successful
        if user is not None:
            login(request, user)
            return HttpResponseRedirect(reverse("forum"))
        else:
            return render(request, "sim/login.html", {
                "message": "Invalid username and/or password."
            })
    else:
        return render(request, "sim/login.html")


def logout_view(request):
    logout(request)
    return HttpResponseRedirect(reverse("forum"))


def register(request):
    if request.method == "POST":
        username = request.POST["username"]
        email = request.POST["email"]

        # Ensure password matches confirmation
        password = request.POST["password"]
        confirmation = request.POST["confirmation"]
        if password != confirmation:
            return render(request, "sim/register.html", {
                "message": "Passwords must match."
            })

        # Attempt to create new user
        try:
            user = User.objects.create_user(username, email, password)
            user.save()
        except IntegrityError:
            return render(request, "sim/register.html", {
                "message": "Username already taken."
            })
        login(request, user)
        return HttpResponseRedirect(reverse("forum"))
    else:
        return render(request, "sim/register.html")
